"use server";
import { createHash } from "node:crypto";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { EntradaRecomposicao } from "./recomposicao-schema";
import { carregarRecomposicaoTx } from "./recomposicao-tx";

const Salvar = EntradaRecomposicao.extend({ chaveIdempotencia: z.string().min(8).max(100), versaoAnterior: z.number().int().nonnegative() });
export async function salvarRascunhoRecomposicao(input: z.input<typeof Salvar>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const parsed = Salvar.parse(input);
    const d = { ...parsed, direitosIds: [...parsed.direitosIds].sort(), periodosPropostos: [...parsed.periodosPropostos].sort((a, b) => a.cobrancaId.localeCompare(b.cobrancaId)) };
    const entradaHash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`recomposicao:${autor.id}:${d.chaveIdempotencia}`}, 0))`;
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some((p) => p === "ADMINISTRADOR" || p === "FINANCEIRO")) throw new ErroPermissao();
      const existente = await tx.rascunhoRecomposicaoCobertura.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (existente) {
        if (existente.entradaHash !== entradaHash) throw new ErroRegra("Chave utilizada com outra proposta.");
        return { id: existente.id, versao: existente.versao };
      }
      await bloquearMatriculas(tx, [d.matriculaId]);
      await tx.$queryRaw`SELECT doc.id FROM "Documento" doc JOIN "Matricula" m ON m."contratoDocumentoId" = doc.id WHERE m.id = ${d.matriculaId} FOR SHARE OF doc`;
      await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE "matriculaId" = ${d.matriculaId} ORDER BY id FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "DiaCompensacaoCobertura" WHERE "matriculaId" = ${d.matriculaId} ORDER BY id FOR UPDATE`;
      const anterior = await tx.rascunhoRecomposicaoCobertura.findFirst({ where: { matriculaId: d.matriculaId }, orderBy: { versao: "desc" } });
      if ((anterior?.versao ?? 0) !== d.versaoAnterior) throw new ErroRegra("Existe uma versão mais recente; atualize a conferência.");
      const entrada = EntradaRecomposicao.parse({ alunoId: d.alunoId, matriculaId: d.matriculaId, direitosIds: d.direitosIds, periodosPropostos: d.periodosPropostos, retornoOferta: d.retornoOferta, inicioCompensacao: d.inicioCompensacao, motivo: d.motivo, evidenciaCondicoes: d.evidenciaCondicoes });
      const snapshot = await carregarRecomposicaoTx(tx, entrada);
      const r = await tx.rascunhoRecomposicaoCobertura.create({ data: { matriculaId: d.matriculaId, preparadorId: autor.id, versao: d.versaoAnterior + 1, chaveIdempotencia: d.chaveIdempotencia, entradaHash, entrada, snapshot } });
      await registrarEvento(tx, { tipo: "RascunhoRecomposicaoPreparado", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id, payload: { rascunhoId: r.id, versao: r.versao } });
      return { id: r.id, versao: r.versao };
    });
  });
}

export async function consultarRascunhoRecomposicao(input: { alunoId: string; matriculaId: string; versao?: number }) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = z.object({ alunoId: z.string().min(1), matriculaId: z.string().min(1), versao: z.number().int().positive().optional() }).strict().parse(input);
    const r = await prisma.rascunhoRecomposicaoCobertura.findFirst({ where: { matriculaId: d.matriculaId, matricula: { alunoId: d.alunoId }, ...(d.versao ? { versao: d.versao } : {}) }, orderBy: { versao: "desc" }, select: { id: true, versao: true, entrada: true, snapshot: true, criadoEm: true, decisao: { select: { aplicacao: { select: { id: true } }, id: true, aprovada: true, motivo: true, decididaEm: true, decisor: { select: { id: true, nome: true } } } }, preparador: { select: { id: true, nome: true } } } });
    return r ? { ...r, criadoEm: r.criadoEm.toISOString(), decisao: r.decisao ? { ...r.decisao, decididaEm: r.decisao.decididaEm.toISOString() } : null } : null;
  });
}
