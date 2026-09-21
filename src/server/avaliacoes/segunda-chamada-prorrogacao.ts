"use server";
import { createHash, randomUUID } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { prazoSegundaChamadaVigente } from "./segunda-chamada-prazo";
import { instanteUtcSql } from "./segunda-chamada-utc";

const id = z.string().min(1).max(100), motivo = z.string().trim().min(5).max(2000);
const proporSchema = z.object({ disponibilizacaoId: id, prazoAnterior: z.string().datetime({ offset: true }), novoPrazo: z.string().datetime({ offset: true }), versaoEsperada: z.number().int().min(0), motivo, chaveIdempotencia: z.string().min(8).max(100) }).strict();
const decidirSchema = z.object({ propostaId: id, propostaHash: z.string().regex(/^[a-f0-9]{64}$/), aprovada: z.boolean(), motivo }).strict();
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

export async function proporProrrogacaoSegundaChamada(input: z.input<typeof proporSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO), original = proporSchema.parse(input);
    const d = { ...original, prazoAnterior: new Date(original.prazoAnterior).toISOString(), novoPrazo: new Date(original.novoPrazo).toISOString() };
    return prisma.$transaction(async tx => {
      const [ref] = await tx.$queryRaw<{ alocacaoId: string; matriculaId: string }[]>(Prisma.sql`SELECT p."alocacaoId" AS "alocacaoId",p."matriculaId" AS "matriculaId" FROM "DisponibilizacaoSegundaChamada" s JOIN "PropostaSegundaChamada" p ON p.id=s."propostaId" WHERE s.id=${d.disponibilizacaoId}`);
      if (!ref) throw new ErroRegra("Disponibilização não encontrada.");
      await bloquearLancamento(tx, ref.alocacaoId);
      const [anterior] = await tx.$queryRaw<{ id: string; entradaHash: string }[]>(Prisma.sql`SELECT id,"entradaHash" AS "entradaHash" FROM "PropostaProrrogacaoSegundaChamada" WHERE "preparadorId"=${u.id} AND "chaveIdempotencia"=${d.chaveIdempotencia} FOR SHARE`);
      if (anterior) { if (anterior.entradaHash !== hash(d)) throw new ErroRegra("Chave utilizada com outra prorrogação."); return { id: anterior.id }; }
      const vigente = await prazoSegundaChamadaVigente(tx, d.disponibilizacaoId), novo = new Date(d.novoPrazo);
      if (vigente.toISOString() !== d.prazoAnterior || novo <= vigente || novo <= new Date()) throw new ErroRegra("Confira o prazo vigente e proponha um novo limite futuro.");
      const [ultima] = await tx.$queryRaw<{ versao: number }[]>(Prisma.sql`SELECT versao FROM "PropostaProrrogacaoSegundaChamada" WHERE "disponibilizacaoId"=${d.disponibilizacaoId} ORDER BY versao DESC LIMIT 1 FOR UPDATE`);
      if ((ultima?.versao ?? 0) !== d.versaoEsperada) throw new ErroRegra("Existe proposta de prorrogação mais recente.");
      const propostaId = randomUUID();
      await tx.$executeRaw(Prisma.sql`INSERT INTO "PropostaProrrogacaoSegundaChamada" (id,"disponibilizacaoId","preparadorId",versao,"prazoAnterior","novoPrazo",motivo,"chaveIdempotencia","entradaHash") VALUES (${propostaId},${d.disponibilizacaoId},${u.id},${d.versaoEsperada + 1},${instanteUtcSql(vigente)},${instanteUtcSql(novo)},${d.motivo},${d.chaveIdempotencia},${hash(d)})`);
      await registrarEvento(tx, { tipo: "ProrrogacaoSegundaChamadaProposta", agregadoTipo: "Matricula", agregadoId: ref.matriculaId, autorId: u.id, payload: { propostaId, prazoAnterior: vigente.toISOString(), novoPrazo: novo.toISOString() } });
      return { id: propostaId, versao: d.versaoEsperada + 1 };
    });
  });
}

export async function decidirProrrogacaoSegundaChamada(input: z.input<typeof decidirSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = decidirSchema.parse(input);
    return prisma.$transaction(async tx => {
      const [ref] = await tx.$queryRaw<{ alocacaoId: string }[]>(Prisma.sql`
        SELECT propostaSegunda."alocacaoId" AS "alocacaoId"
        FROM "PropostaProrrogacaoSegundaChamada" proposta
        JOIN "DisponibilizacaoSegundaChamada" disponibilidade ON disponibilidade.id=proposta."disponibilizacaoId"
        JOIN "PropostaSegundaChamada" propostaSegunda ON propostaSegunda.id=disponibilidade."propostaId"
        WHERE proposta.id=${d.propostaId}
      `);
      if (!ref) throw new ErroRegra("Prorrogação não encontrada.");
      await bloquearLancamento(tx, ref.alocacaoId);
      const [p] = await tx.$queryRaw<{ id: string; entradaHash: string; preparadorId: string; disponibilizacaoId: string; prazoAnterior: Date; novoPrazo: Date; versao: number; alocacaoId: string; matriculaId: string; decisaoId: string | null }[]>(Prisma.sql`
        SELECT p.id,p."entradaHash" AS "entradaHash",p."preparadorId" AS "preparadorId",p."disponibilizacaoId" AS "disponibilizacaoId",p."prazoAnterior" AS "prazoAnterior",p."novoPrazo" AS "novoPrazo",p.versao,s2."alocacaoId" AS "alocacaoId",s2."matriculaId" AS "matriculaId",d.id AS "decisaoId"
        FROM "PropostaProrrogacaoSegundaChamada" p JOIN "DisponibilizacaoSegundaChamada" s ON s.id=p."disponibilizacaoId" JOIN "PropostaSegundaChamada" s2 ON s2.id=s."propostaId" LEFT JOIN "DecisaoProrrogacaoSegundaChamada" d ON d."propostaId"=p.id WHERE p.id=${d.propostaId} FOR UPDATE OF p,s,s2
      `);
      if (!p || p.alocacaoId !== ref.alocacaoId) throw new ErroRegra("A prorrogação mudou. Atualize a operação.");
      await conferirGestorAvaliacao(tx, u.id);
      if (p.preparadorId === u.id || p.entradaHash !== d.propostaHash) throw new ErroRegra("Outra pessoa deve conferir a prorrogação exata.");
      if (p.decisaoId) throw new ErroRegra("A prorrogação já possui decisão.");
      if (d.aprovada) {
        const vigente = await prazoSegundaChamadaVigente(tx, p.disponibilizacaoId);
        if (vigente.getTime() !== p.prazoAnterior.getTime() || p.novoPrazo <= vigente || p.novoPrazo <= new Date()) throw new ErroRegra("O prazo mudou ou a proposta venceu.");
      }
      const decisaoId = randomUUID(); await tx.$executeRaw(Prisma.sql`INSERT INTO "DecisaoProrrogacaoSegundaChamada" (id,"propostaId","decisorId",aprovada,motivo) VALUES (${decisaoId},${p.id},${u.id},${d.aprovada},${d.motivo})`);
      await registrarEvento(tx, { tipo: d.aprovada ? "ProrrogacaoSegundaChamadaAprovada" : "ProrrogacaoSegundaChamadaRejeitada", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId: u.id, payload: { propostaId: p.id, decisaoId, novoPrazo: p.novoPrazo.toISOString() } });
      return { id: decisaoId };
    });
  });
}
