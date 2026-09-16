"use server";
import { randomUUID } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";
import { instanteUtcSql } from "./segunda-chamada-utc";

const schema = z.object({ propostaId: z.string().min(1).max(100), propostaHash: z.string().regex(/^[a-f0-9]{64}$/), disponibilizadaEm: z.string().datetime({ offset: true }), condicoes: z.string().trim().min(5).max(4000), evidenciaComunicacao: z.string().trim().min(5).max(4000) }).strict();

/** Q149: publica as condições uma vez e fixa o prazo configurado da regra vinculada. */
export async function disponibilizarSegundaChamada(input: z.input<typeof schema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = schema.parse(input);
    return prisma.$transaction(async tx => {
      const [ref] = await tx.$queryRaw<{ alocacaoId: string }[]>(Prisma.sql`SELECT "alocacaoId" AS "alocacaoId" FROM "PropostaSegundaChamada" WHERE id=${d.propostaId}`);
      if (!ref) throw new ErroRegra("Proposta de segunda chamada não encontrada.");
      const a = await bloquearLancamento(tx, ref.alocacaoId); await conferirGestorAvaliacao(tx, u.id);
      const [p] = await tx.$queryRaw<{ id: string; entradaHash: string; matriculaId: string; regraId: string; aprovada: boolean | null; autorId: string; existente: string | null; decididaEm: Date | null }[]>(Prisma.sql`
        SELECT p.id,p."entradaHash" AS "entradaHash",p."matriculaId" AS "matriculaId",p."regraId" AS "regraId",p."autorId" AS "autorId",d.aprovada,d."criadaEm" AS "decididaEm",s.id AS existente
        FROM "PropostaSegundaChamada" p LEFT JOIN "DecisaoSegundaChamada" d ON d."propostaId"=p.id
        LEFT JOIN "DisponibilizacaoSegundaChamada" s ON s."propostaId"=p.id WHERE p.id=${d.propostaId} FOR UPDATE OF p
      `);
      if (!p || p.entradaHash !== d.propostaHash || !p.aprovada) throw new ErroRegra("Confira a proposta aprovada exata antes de disponibilizar.");
      const inicio = new Date(d.disponibilizadaEm);
      if (inicio > new Date() || !p.decididaEm || inicio < p.decididaEm) throw new ErroRegra("A disponibilização deve ser posterior à autorização e não pode ser futura.");
      if (p.existente) {
        const anterior = await tx.disponibilizacaoSegundaChamada.findUniqueOrThrow({ where: { id: p.existente } });
        if (anterior.autorId === u.id && anterior.disponibilizadaEm.getTime() === inicio.getTime() && anterior.condicoes === d.condicoes && anterior.evidenciaComunicacao === d.evidenciaComunicacao) return { id: anterior.id, prazoAte: anterior.prazoAte.toISOString() };
        throw new ErroRegra("A disponibilização já existe; use o fluxo de prorrogação.");
      }
      if (!a.ativa || (await tx.matricula.findUniqueOrThrow({ where: { id: a.matriculaId }, select: { status: true } })).status !== "ATIVA") throw new ErroRegra("Disponibilização exige matrícula e vínculo ativos.");
      const regra = await tx.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: p.regraId }, select: { conteudo: true } });
      const prazoRegraMinutos = ConteudoRegraAvaliacaoSchema.parse(regra.conteudo).segundaChamada.prazoRealizacaoMinutos;
      const prazoAte = new Date(inicio.getTime() + prazoRegraMinutos * 60000), id = randomUUID();
      await tx.$executeRaw(Prisma.sql`INSERT INTO "DisponibilizacaoSegundaChamada" (id,"propostaId","autorId","disponibilizadaEm","prazoRegraMinutos","prazoAte",condicoes,"evidenciaComunicacao") VALUES (${id},${p.id},${u.id},${instanteUtcSql(inicio)},${prazoRegraMinutos},${instanteUtcSql(prazoAte)},${d.condicoes},${d.evidenciaComunicacao})`);
      await registrarEvento(tx, { tipo: "SegundaChamadaDisponibilizada", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId: u.id, payload: { propostaId: p.id, disponibilizacaoId: id, prazoAte: prazoAte.toISOString(), prazoRegraMinutos } });
      return { id, prazoAte: prazoAte.toISOString() };
    });
  });
}




