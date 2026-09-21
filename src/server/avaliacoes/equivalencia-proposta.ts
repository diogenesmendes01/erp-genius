"use server";

import { createHash, randomUUID } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { exigirUsuarioAcademicoAtual, APROVADORES_ACADEMICOS } from "@/server/academico/estado";
import { EntradaEquivalenciaTransferenciaSchema } from "./equivalencia-transferencia";
import { conferirEstadoEquivalenciaTx } from "./equivalencia-estado-tx";

const id = z.string().trim().min(1).max(100);
const consultaSchema = z.object({ matriculaId: id, alocacaoOrigemId: id, turmaDestinoId: id,
  mapeamentos: EntradaEquivalenciaTransferenciaSchema.shape.mapeamentos }).strict();
const propostaSchema = consultaSchema.extend({
  estadoHash: z.string().regex(/^[a-f0-9]{64}$/), versaoEsperada: z.number().int().nonnegative(),
  motivo: z.string().trim().min(5).max(4000), chaveIdempotencia: id,
}).strict();

async function conferirAutor(tx: Prisma.TransactionClient, autorId: string) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autorId} FOR SHARE`;
  await exigirUsuarioAcademicoAtual(tx, autorId, APROVADORES_ACADEMICOS);
}

/** Prévia reservada à gestão; não cria proposta, reserva ou transferência. */
export async function revisarEquivalenciaTransferencia(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const entrada = consultaSchema.parse(input);
    return prisma.$transaction(async tx => {
      const estado = await conferirEstadoEquivalenciaTx(tx, entrada);
      await conferirAutor(tx, autor.id);
      const [ultima] = await tx.$queryRaw<Array<{ versao: number }>>(Prisma.sql`
        SELECT versao FROM "PropostaEquivalenciaAvaliacao"
        WHERE "matriculaId"=${entrada.matriculaId} AND "alocacaoOrigemId"=${entrada.alocacaoOrigemId}
          AND "turmaDestinoId"=${entrada.turmaDestinoId} ORDER BY versao DESC LIMIT 1
      `);
      return { estadoHash: estado.estadoHash, versaoAtual: ultima?.versao ?? 0,
        contexto: estado.snapshot.contexto, fontes: estado.snapshot.fontesOficiais, projecao: estado.projecao };
    });
  });
}

/** Q153: somente a gestão prepara o aproveitamento. A Secretaria executará a
 * transferência depois da decisão independente; esta ação não a efetiva. */
export async function proporEquivalenciaTransferencia(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const entrada = propostaSchema.parse(input);
    const entradaHash = createHash("sha256").update(JSON.stringify(entrada)).digest("hex");
    return prisma.$transaction(async tx => {
      const estado = await conferirEstadoEquivalenciaTx(tx, entrada);
      await conferirAutor(tx, autor.id);
      const [repetida] = await tx.$queryRaw<Array<{ id: string; entradaHash: string }>>(Prisma.sql`
        SELECT id,"entradaHash" FROM "PropostaEquivalenciaAvaliacao"
        WHERE "preparadorId"=${autor.id} AND "chaveIdempotencia"=${entrada.chaveIdempotencia}
      `);
      if (repetida) {
        if (repetida.entradaHash !== entradaHash) throw new ErroRegra("A chave já foi usada por outra proposta.");
        return { id: repetida.id };
      }
      if (estado.estadoHash !== entrada.estadoHash) throw new ErroRegra("As fontes ou condições mudaram. Revise o aproveitamento novamente.");
      const [ultima] = await tx.$queryRaw<Array<{ versao: number }>>(Prisma.sql`
        SELECT versao FROM "PropostaEquivalenciaAvaliacao" WHERE "matriculaId"=${entrada.matriculaId}
          AND "alocacaoOrigemId"=${entrada.alocacaoOrigemId} AND "turmaDestinoId"=${entrada.turmaDestinoId}
        ORDER BY versao DESC LIMIT 1
      `);
      if ((ultima?.versao ?? 0) !== entrada.versaoEsperada) throw new ErroRegra("Outra proposta foi registrada. Atualize a revisão.");
      const propostaId = randomUUID(), c = estado.snapshot.contexto;
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "PropostaEquivalenciaAvaliacao" (id,"matriculaId","alocacaoOrigemId","turmaOrigemId","turmaDestinoId",
          "regraOrigemId","regraDestinoId",versao,mapeamentos,snapshot,motivo,"preparadorId","chaveIdempotencia","entradaHash")
        VALUES (${propostaId},${c.matriculaId},${c.alocacaoOrigemId},${c.turmaOrigemId},${c.turmaDestinoId},
          ${c.regraOrigemId},${c.regraDestinoId},${entrada.versaoEsperada + 1},${JSON.stringify(entrada.mapeamentos)}::jsonb,
          ${JSON.stringify({ ...estado.snapshot, estadoHash: estado.estadoHash })}::jsonb,${entrada.motivo},${autor.id},${entrada.chaveIdempotencia},${entradaHash})
      `);
      await registrarEvento(tx, { tipo: "EquivalenciaAvaliacaoProposta", agregadoTipo: "Matricula", agregadoId: c.matriculaId, autorId: autor.id,
        payload: { propostaId, alocacaoOrigemId: c.alocacaoOrigemId, turmaDestinoId: c.turmaDestinoId, estadoHash: estado.estadoHash } });
      return { id: propostaId };
    });
  });
}
