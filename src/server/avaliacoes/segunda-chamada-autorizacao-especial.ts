"use server";
import { createHash, randomUUID } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { conferirGestorAvaliacao } from "./regras-tx";
import { estadoSegundaChamadaTx } from "./segunda-chamada-tx";
import { instanteUtcSql } from "./segunda-chamada-utc";

const schema = z.object({ alocacaoId: z.string().min(1).max(100), codigoAvaliacao: z.string().min(1).max(100), prazoAte: z.string().datetime({ offset: true }), motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict();
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

/** Q151: autorização pontual não reativa matrícula nem cria saldo, prazo geral ou acesso amplo. */
export async function autorizarRealizacaoEspecialSegundaChamada(input: z.input<typeof schema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = schema.parse(input);
    return prisma.$transaction(async tx => {
      await conferirGestorAvaliacao(tx, u.id);
      const estado = await estadoSegundaChamadaTx(tx, d.alocacaoId, d.codigoAvaliacao);
      const [anterior] = await tx.$queryRaw<{ id: string; entradaHash: string; prazoAte: Date }[]>(Prisma.sql`SELECT id,"entradaHash", "prazoAte" FROM "AutorizacaoEspecialSegundaChamada" WHERE "autorizadorId"=${u.id} AND "chaveIdempotencia"=${d.chaveIdempotencia} FOR SHARE`);
      if (anterior) { if (anterior.entradaHash !== hash(d)) throw new ErroRegra("Chave usada com outra autorização especial."); return { id: anterior.id, prazoAte: anterior.prazoAte.toISOString() }; }
      if (!["PAUSADA", "ENCERRADA"].includes(estado.statusMatricula)) throw new ErroRegra("A autorização especial exige matrícula pausada ou encerrada.");
      if (!estado.pendente || !estado.regraId) throw new ErroRegra("A autorização exige avaliação pendente identificada pela regra.");
      const prazoAte = new Date(d.prazoAte); if (prazoAte <= new Date()) throw new ErroRegra("A autorização especial precisa ter prazo futuro.");
      const id = randomUUID(); await tx.$executeRaw(Prisma.sql`INSERT INTO "AutorizacaoEspecialSegundaChamada" (id,"matriculaId","alocacaoId","regraId","codigoAvaliacao","autorizadorId",motivo,"prazoAte","chaveIdempotencia","entradaHash") VALUES (${id},${estado.matriculaId},${estado.alocacaoId},${estado.regraId},${estado.codigoAvaliacao},${u.id},${d.motivo},${instanteUtcSql(prazoAte)},${d.chaveIdempotencia},${hash(d)})`);
      await registrarEvento(tx, { tipo: "SegundaChamadaAutorizacaoEspecial", agregadoTipo: "Matricula", agregadoId: estado.matriculaId, autorId: u.id, payload: { autorizacaoId: id, codigoAvaliacao: estado.codigoAvaliacao, prazoAte: prazoAte.toISOString() } });
      return { id, prazoAte: prazoAte.toISOString() };
    });
  });
}

export async function autorizacaoEspecialSegundaChamadaVigente(tx: Prisma.TransactionClient, alocacaoId: string, codigoAvaliacao: string, quando: Date) {
  if (!Number.isFinite(quando.getTime())) return false;
  const [r] = await tx.$queryRaw<{ vigente: boolean }[]>(Prisma.sql`SELECT autorizacao_especial_segunda_chamada_valida(${alocacaoId},${codigoAvaliacao},${instanteUtcSql(quando)}) AS vigente`);
  return r?.vigente === true;
}


