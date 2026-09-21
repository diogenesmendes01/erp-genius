"use server";
import { createHash, randomUUID } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { estadoSegundaChamadaTx } from "./segunda-chamada-tx";
import { instanteUtcOuNuloSql, instanteUtcSql } from "./segunda-chamada-utc";

const schema = z.object({ propostaId: z.string().min(1).max(100), professorId: z.string().min(1).max(100), inicio: z.string().datetime({ offset: true }), fim: z.string().datetime({ offset: true }).optional(), motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict();
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

/** Q152: designa acesso temporal somente para a segunda chamada identificada; não transfere fatos passados. */
export async function designarProfessorSegundaChamada(input: z.input<typeof schema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = schema.parse(input);
    return prisma.$transaction(async tx => {
      const [ref] = await tx.$queryRaw<{ alocacaoId: string }[]>(Prisma.sql`SELECT "alocacaoId" AS "alocacaoId" FROM "PropostaSegundaChamada" WHERE id=${d.propostaId}`);
      if (!ref) throw new ErroRegra("Proposta de segunda chamada não encontrada.");
      await bloquearLancamento(tx, ref.alocacaoId);
      const [p] = await tx.$queryRaw<{ id: string; alocacaoId: string; matriculaId: string; regraId: string; codigoAvaliacao: string; entradaHash: string }[]>(Prisma.sql`SELECT id,"alocacaoId" AS "alocacaoId","matriculaId" AS "matriculaId","regraId" AS "regraId","codigoAvaliacao" AS "codigoAvaliacao","entradaHash" AS "entradaHash" FROM "PropostaSegundaChamada" WHERE id=${d.propostaId} FOR UPDATE`);
      if (!p || p.alocacaoId !== ref.alocacaoId) throw new ErroRegra("A proposta de segunda chamada mudou. Atualize a operação.");
      await conferirGestorAvaliacao(tx, u.id);
      const [anterior] = await tx.$queryRaw<{ id: string; entradaHash: string }[]>(Prisma.sql`SELECT id,"entradaHash" AS "entradaHash" FROM "DesignacaoSegundaChamada" WHERE "gestorId"=${u.id} AND "chaveIdempotencia"=${d.chaveIdempotencia} FOR SHARE`);
      if (anterior) { if (anterior.entradaHash !== hash(d)) throw new ErroRegra("Chave usada com outra designação."); return { id: anterior.id }; }
      const estado = await estadoSegundaChamadaTx(tx, p.alocacaoId, p.codigoAvaliacao);
      if (!estado.pendente || estado.regraId !== p.regraId) throw new ErroRegra("A designação exige avaliação pendente na regra correspondente.");
      const professor = await tx.usuario.findUnique({ where: { id: d.professorId }, select: { ativo: true, papeis: true } });
      if (!professor?.ativo || !professor.papeis.includes(Papel.PROFESSOR)) throw new ErroRegra("Professor designado precisa estar ativo.");
      const inicio = new Date(d.inicio), fim = d.fim ? new Date(d.fim) : null;
      if (inicio > new Date() || (fim && fim <= inicio)) throw new ErroRegra("Informe vigência válida da designação.");
      const [ultima] = await tx.$queryRaw<{ versao: number }[]>(Prisma.sql`SELECT versao FROM "DesignacaoSegundaChamada" WHERE "propostaId"=${p.id} ORDER BY versao DESC LIMIT 1 FOR UPDATE`);
      const id = randomUUID(); await tx.$executeRaw(Prisma.sql`INSERT INTO "DesignacaoSegundaChamada" (id,"propostaId","professorId","gestorId",versao,inicio,fim,motivo,"chaveIdempotencia","entradaHash","criadaEm") VALUES (${id},${p.id},${d.professorId},${u.id},${(ultima?.versao ?? 0)+1},${instanteUtcSql(inicio)},${instanteUtcOuNuloSql(fim)},${d.motivo},${d.chaveIdempotencia},${hash(d)},clock_timestamp() AT TIME ZONE 'UTC')`);
      await registrarEvento(tx, { tipo: "ProfessorSegundaChamadaDesignado", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId: u.id, payload: { propostaId: p.id, designacaoId: id, professorId: d.professorId, inicio: inicio.toISOString(), fim: fim?.toISOString() ?? null } });
      return { id };
    });
  });
}
