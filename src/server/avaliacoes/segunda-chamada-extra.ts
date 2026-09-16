"use server";
import { createHash, randomUUID } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { carregarConsolidadoAvaliacoesTx } from "./consolidado-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { estadoSegundaChamadaTx } from "./segunda-chamada-tx";

const id = z.string().min(1).max(100), texto = z.string().trim().min(5).max(4000), hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const proporSchema = z.object({ alocacaoId: id, codigoAvaliacao: id, quantidade: z.number().int().positive().max(100), motivo: texto, evidencias: texto, chaveIdempotencia: z.string().min(8).max(100) }).strict();
const decidirSchema = z.object({ propostaId: id, propostaHash: z.string().regex(/^[a-f0-9]{64}$/), aprovada: z.boolean(), motivo: texto }).strict();

/** Q150: concede somente saldo excepcional para esta avaliação pendente; não altera a regra nem libera recuperação. */
export async function proporExtraSegundaChamada(input: z.input<typeof proporSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO), d = proporSchema.parse(input);
    return prisma.$transaction(async tx => {
      await carregarConsolidadoAvaliacoesTx(tx, u.id, d.alocacaoId, "ACOMPANHAMENTO");
      const [anterior] = await tx.$queryRaw<{ id: string; entradaHash: string }[]>(Prisma.sql`SELECT id,"entradaHash" AS "entradaHash" FROM "PropostaExtraSegundaChamada" WHERE "autorId"=${u.id} AND "chaveIdempotencia"=${d.chaveIdempotencia} FOR SHARE`);
      if (anterior) { if (anterior.entradaHash !== hash(d)) throw new ErroRegra("Chave usada com outro pedido de extra."); return { id: anterior.id }; }
      const estado = await estadoSegundaChamadaTx(tx, d.alocacaoId, d.codigoAvaliacao);
      if (!estado.pendente) throw new ErroRegra("Extra exige avaliação ainda pendente.");
      const propostaId = randomUUID();
      await tx.$executeRaw(Prisma.sql`INSERT INTO "PropostaExtraSegundaChamada" (id,"matriculaId","alocacaoId","regraId","codigoAvaliacao",quantidade,"autorId",motivo,evidencias,"chaveIdempotencia","entradaHash") VALUES (${propostaId},${estado.matriculaId},${estado.alocacaoId},${estado.regraId},${estado.codigoAvaliacao},${d.quantidade},${u.id},${d.motivo},${d.evidencias},${d.chaveIdempotencia},${hash(d)})`);
      await registrarEvento(tx, { tipo: "ExtraSegundaChamadaProposto", agregadoTipo: "Matricula", agregadoId: estado.matriculaId, autorId: u.id, payload: { propostaId, codigoAvaliacao: estado.codigoAvaliacao, quantidade: d.quantidade } });
      return { id: propostaId };
    });
  });
}

export async function decidirExtraSegundaChamada(input: z.input<typeof decidirSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = decidirSchema.parse(input);
    return prisma.$transaction(async tx => {
      const [p] = await tx.$queryRaw<{ id: string; autorId: string; entradaHash: string; matriculaId: string; regraId: string; codigoAvaliacao: string; alocacaoId: string; decisaoId: string | null }[]>(Prisma.sql`
        SELECT p.id,p."autorId" AS "autorId",p."entradaHash" AS "entradaHash",p."matriculaId" AS "matriculaId",p."regraId" AS "regraId",p."codigoAvaliacao" AS "codigoAvaliacao",p."alocacaoId" AS "alocacaoId",d.id AS "decisaoId"
        FROM "PropostaExtraSegundaChamada" p
        LEFT JOIN "DecisaoExtraSegundaChamada" d ON d."propostaId"=p.id WHERE p.id=${d.propostaId} FOR UPDATE
      `);
      if (!p) throw new ErroRegra("Proposta de extra não encontrada ou sem avaliação identificada.");
      await conferirGestorAvaliacao(tx, u.id);
      if (p.autorId === u.id || p.entradaHash !== d.propostaHash || p.decisaoId) throw new ErroRegra("Outra pessoa deve decidir a proposta exata de extra.");
      if (d.aprovada && !(await estadoSegundaChamadaTx(tx, p.alocacaoId, p.codigoAvaliacao)).pendente) throw new ErroRegra("A avaliação não está mais pendente.");
      const decisaoId = randomUUID(); await tx.$executeRaw(Prisma.sql`INSERT INTO "DecisaoExtraSegundaChamada" (id,"propostaId","decisorId",aprovada,motivo) VALUES (${decisaoId},${p.id},${u.id},${d.aprovada},${d.motivo})`);
      await registrarEvento(tx, { tipo: d.aprovada ? "ExtraSegundaChamadaAprovado" : "ExtraSegundaChamadaRejeitado", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId: u.id, payload: { propostaId: p.id, decisaoId, codigoAvaliacao: p.codigoAvaliacao } });
      return { id: decisaoId };
    });
  });
}


