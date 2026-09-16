"use server";

import { createHash, randomUUID } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { APROVADORES_ACADEMICOS, EXECUTORES_ACADEMICOS, bloquearEstadoAcademico, exigirUsuarioAcademicoAtual } from "@/server/academico/estado";
import { EntradaEquivalenciaTransferenciaSchema } from "./equivalencia-transferencia";
import { conferirEstadoEquivalenciaTx } from "./equivalencia-estado-tx";

const executarSchema = z.object({
  decisaoId: z.string().trim().min(1).max(100),
  motivo: z.string().trim().min(5).max(4000),
  horarioCompativel: z.literal(true),
}).strict();

const snapshotAprovadoSchema = z.object({
  estadoHash: z.string().regex(/^[a-f0-9]{64}$/),
}).passthrough();

const instanteUtcSql = (valor: Date) => Prisma.sql`${valor.toISOString()}::timestamptz AT TIME ZONE 'UTC'`;

function revalidar(alunoId: string) {
  revalidatePath("/academico");
  revalidatePath("/secretaria");
  revalidatePath("/diario");
  revalidatePath("/alunos", "layout");
  revalidatePath(`/alunos/${alunoId}`);
  revalidatePath("/configuracao/turmas");
}

type DecisaoBloqueada = {
  decisaoId: string;
  aprovada: boolean;
  decisorId: string;
  propostaId: string;
  preparadorId: string;
  matriculaId: string;
  alocacaoOrigemId: string;
  turmaOrigemId: string;
  turmaDestinoId: string;
  regraOrigemId: string;
  regraDestinoId: string;
  versao: number;
  mapeamentos: unknown;
  snapshot: unknown;
  aplicacaoId: string | null;
};

/**
 * Q153: efetiva exclusivamente a decisão aprovada e ainda vigente. A aplicação
 * não materializa notas no destino: conserva as referências e o mapa aprovados
 * no mesmo fato que encerra o vínculo de origem e cria o de destino.
 */
export async function executarEquivalenciaTransferencia(input: unknown) {
  return executarAcao(async () => {
    const executor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    const entrada = executarSchema.parse(input);
    const resultado = await prisma.$transaction(async (tx) => {
      // Sem lock: só descobre a chave que define a ordem de serialização. A
      // proposta/decisão são relidas e bloqueadas depois da trava acadêmica.
      const referencia = await tx.decisaoEquivalenciaAvaliacao.findUnique({ where: { id: entrada.decisaoId }, select: {
        proposta: { select: { matriculaId: true, alocacaoOrigemId: true, turmaDestinoId: true, matricula: { select: { alunoId: true } } } },
      } });
      if (!referencia) throw new ErroRegra("Decisão de equivalência não encontrada.");
      await bloquearEstadoAcademico(tx, referencia.proposta.matricula.alunoId, referencia.proposta.turmaDestinoId);
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`equivalencia-avaliacao:${referencia.proposta.matriculaId}:${referencia.proposta.alocacaoOrigemId}:${referencia.proposta.turmaDestinoId}`}, 0))`);
      const [decisao] = await tx.$queryRaw<DecisaoBloqueada[]>(Prisma.sql`
        SELECT d.id AS "decisaoId",d.aprovada,d."decisorId" AS "decisorId",
          p.id AS "propostaId",p."preparadorId" AS "preparadorId",p."matriculaId" AS "matriculaId",
          p."alocacaoOrigemId" AS "alocacaoOrigemId",p."turmaOrigemId" AS "turmaOrigemId",
          p."turmaDestinoId" AS "turmaDestinoId",p."regraOrigemId" AS "regraOrigemId",
          p."regraDestinoId" AS "regraDestinoId",p.versao,p.mapeamentos,p.snapshot,
          a.id AS "aplicacaoId"
        FROM "DecisaoEquivalenciaAvaliacao" d
        JOIN "PropostaEquivalenciaAvaliacao" p ON p.id=d."propostaId"
        LEFT JOIN "AplicacaoEquivalenciaAvaliacao" a ON a."decisaoId"=d.id
        WHERE d.id=${entrada.decisaoId}
        FOR UPDATE OF d,p
      `);
      if (!decisao) throw new ErroRegra("Decisão de equivalência não encontrada.");
      if (decisao.matriculaId !== referencia.proposta.matriculaId || decisao.alocacaoOrigemId !== referencia.proposta.alocacaoOrigemId || decisao.turmaDestinoId !== referencia.proposta.turmaDestinoId) {
        throw new ErroRegra("A decisão mudou durante a conferência. Atualize a equivalência.");
      }
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Usuario" WHERE id IN (${Prisma.join([executor.id, decisao.preparadorId, decisao.decisorId].sort())}) ORDER BY id FOR SHARE`);
      await exigirUsuarioAcademicoAtual(tx, executor.id, EXECUTORES_ACADEMICOS);
      if (!decisao.aprovada) throw new ErroRegra("Somente decisão aprovada pode efetivar a equivalência.");
      if (decisao.preparadorId === decisao.decisorId) throw new ErroRegra("A aprovação da equivalência precisa ser independente da proposta.");
      await exigirUsuarioAcademicoAtual(tx, decisao.preparadorId, APROVADORES_ACADEMICOS);
      await exigirUsuarioAcademicoAtual(tx, decisao.decisorId, APROVADORES_ACADEMICOS);
      if (decisao.aplicacaoId) {
        const aplicacao = await tx.aplicacaoEquivalenciaAvaliacao.findUniqueOrThrow({ where: { id: decisao.aplicacaoId }, select: {
          id: true, alocacaoDestinoId: true, movimentacaoId: true, matricula: { select: { alunoId: true } },
        } });
        return { alunoId: aplicacao.matricula.alunoId, aplicacaoId: aplicacao.id,
          alocacaoDestinoId: aplicacao.alocacaoDestinoId, movimentacaoId: aplicacao.movimentacaoId };
      }

      const [maisRecente] = await tx.$queryRaw<{ versao: number }[]>(Prisma.sql`
        SELECT versao FROM "PropostaEquivalenciaAvaliacao"
        WHERE "matriculaId"=${decisao.matriculaId} AND "alocacaoOrigemId"=${decisao.alocacaoOrigemId}
          AND "turmaDestinoId"=${decisao.turmaDestinoId}
        ORDER BY versao DESC LIMIT 1
      `);
      if (!maisRecente || maisRecente.versao !== decisao.versao) {
        throw new ErroRegra("Há proposta de equivalência mais recente. Revise e decida novamente.");
      }

      const mapeamentos = EntradaEquivalenciaTransferenciaSchema.shape.mapeamentos.parse(decisao.mapeamentos);
      const snapshotAprovado = snapshotAprovadoSchema.parse(decisao.snapshot);
      const estado = await conferirEstadoEquivalenciaTx(tx, {
        matriculaId: decisao.matriculaId,
        alocacaoOrigemId: decisao.alocacaoOrigemId,
        turmaDestinoId: decisao.turmaDestinoId,
        mapeamentos,
      });
      const contexto = estado.snapshot.contexto;
      if (snapshotAprovado.estadoHash !== estado.estadoHash
        || contexto.matriculaId !== decisao.matriculaId
        || contexto.alocacaoOrigemId !== decisao.alocacaoOrigemId
        || contexto.turmaOrigemId !== decisao.turmaOrigemId
        || contexto.turmaDestinoId !== decisao.turmaDestinoId
        || contexto.regraOrigemId !== decisao.regraOrigemId
        || contexto.regraDestinoId !== decisao.regraDestinoId) {
        throw new ErroRegra("As fontes, regras, vaga ou vínculo mudaram desde a decisão. Prepare nova equivalência.");
      }

      const [relogio] = await tx.$queryRaw<{ agora: Date }[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS agora`;
      if (!relogio) throw new ErroRegra("Relógio transacional indisponível.");
      const agora = relogio.agora;
      const alocacaoDestinoId = randomUUID();
      const movimentacaoId = randomUUID();
      const aplicacaoId = randomUUID();
      const snapshotAplicado = { ...estado.snapshot, estadoHash: estado.estadoHash };
      const aplicacaoHash = createHash("sha256").update(JSON.stringify({
        decisaoId: decisao.decisaoId, mapeamentos, snapshotAplicado, motivo: entrada.motivo,
      })).digest("hex");

      const origemEncerrada = await tx.$executeRaw(Prisma.sql`
        UPDATE "AlocacaoTurma" SET ativa=false,"encerradaEm"=${instanteUtcSql(agora)}
        WHERE id=${decisao.alocacaoOrigemId} AND ativa=true AND "matriculaId"=${decisao.matriculaId}
      `);
      if (origemEncerrada !== 1) throw new ErroRegra("A alocação de origem mudou durante a equivalência. Atualize a decisão.");
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "AlocacaoTurma" (id,"alunoId","matriculaId","turmaId",ativa,"criadoEm")
        VALUES (${alocacaoDestinoId},${estado.alunoId},${decisao.matriculaId},${decisao.turmaDestinoId},true,${instanteUtcSql(agora)})
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "MovimentacaoAluno" (id,"alunoId","matriculaId",tipo,"turmaOrigemId","turmaDestinoId",motivo,observacao,"usuarioId","criadoEm")
        VALUES (${movimentacaoId},${estado.alunoId},${decisao.matriculaId},'TROCA_TURMA'::"TipoMovimentacao",${decisao.turmaOrigemId},${decisao.turmaDestinoId},${entrada.motivo},${`Equivalência acadêmica aprovada: ${decisao.decisaoId}`},${executor.id},${instanteUtcSql(agora)})
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "AplicacaoEquivalenciaAvaliacao" (id,"decisaoId","matriculaId","alocacaoOrigemId","alocacaoDestinoId",
          "turmaOrigemId","turmaDestinoId","regraOrigemId","regraDestinoId","movimentacaoId","mapeamentosAplicados",
          "snapshotAplicado","aplicacaoHash","aplicadoPorId","aplicadaEm")
        VALUES (${aplicacaoId},${decisao.decisaoId},${decisao.matriculaId},${decisao.alocacaoOrigemId},${alocacaoDestinoId},
          ${decisao.turmaOrigemId},${decisao.turmaDestinoId},${decisao.regraOrigemId},${decisao.regraDestinoId},${movimentacaoId},
          ${JSON.stringify(mapeamentos)}::jsonb,${JSON.stringify(snapshotAplicado)}::jsonb,${aplicacaoHash},${executor.id},${instanteUtcSql(agora)})
      `);
      await tx.evento.createMany({ data: [
        { tipo: "EquivalenciaAvaliacaoAplicada", agregadoTipo: "Matricula", agregadoId: decisao.matriculaId, autorId: executor.id, criadoEm: agora,
          payload: { decisaoId: decisao.decisaoId, propostaId: decisao.propostaId, aplicacaoId, alocacaoOrigemId: decisao.alocacaoOrigemId,
            alocacaoDestinoId, turmaOrigemId: decisao.turmaOrigemId, turmaDestinoId: decisao.turmaDestinoId, movimentacaoId,
            horarioCompativel: true, aplicadaEm: agora.toISOString() } },
        { tipo: "TrocaTurma", agregadoTipo: "Aluno", agregadoId: estado.alunoId, autorId: executor.id, criadoEm: agora,
          payload: { de: decisao.turmaOrigemId, para: decisao.turmaDestinoId, motivo: entrada.motivo, decisaoId: decisao.decisaoId,
            aplicacaoId, horarioCompativel: true, aplicadaEm: agora.toISOString() } },
      ] });
      return { alunoId: estado.alunoId, aplicacaoId, alocacaoDestinoId, movimentacaoId };
    });
    revalidar(resultado.alunoId);
    return resultado;
  });
}
