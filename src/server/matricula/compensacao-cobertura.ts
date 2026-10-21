"use server";
import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { DataCivilSchema } from "./cobertura";
import { apurarDiasIndisponibilidadeCoberturaTx } from "./apuracao-indisponibilidade-cobertura";

const Dias = z.array(DataCivilSchema).min(1).max(366).refine((d) => new Set(d).size === d.length, "Não repita dias.");
const Preparar = z.object({ matriculaId: z.string().min(1), cobrancaId: z.string().min(1), versaoCobranca: z.number().int().nonnegative(),
  dias: Dias, motivo: z.string().trim().min(5).max(2000), evidenciaCondicoes: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict();
async function exigirFinanceiro(tx: Prisma.TransactionClient, id: string, decidir = false) {
  const u = await tx.usuario.findUnique({ where: { id }, select: { ativo: true, papeis: true, permissoes: true } });
  if (!u?.ativo || (!u.papeis.includes(Papel.ADMINISTRADOR) && (!u.papeis.includes(Papel.FINANCEIRO) || (decidir && !u.permissoes.includes("financeiro.aprovar_acertos"))))) throw new ErroPermissao("A decisão exige Administração ou Financeiro com permissão de aprovação.");
}
async function fonte(tx: Prisma.TransactionClient, matriculaId: string, cobrancaId: string, dias: string[]) {
  const c = await tx.cobranca.findFirst({ where: { id: cobrancaId, matriculaId }, include: { matricula: true } });
  if (!c || c.tipo !== "MENSALIDADE" || c.status === "CANCELADA" || !c.coberturaInicio || !c.coberturaFim || c.coberturaFim < c.coberturaInicio || c.suspensaPorItemPausaId || c.canceladaPorPausaId) throw new ErroRegra("Conferir mensalidade e cobertura de origem antes de preparar compensação.");
  const m = c.matricula;
  if (!["ATIVA", "PAUSADA"].includes(m.status) || !m.contratoOk || !m.confirmacaoContratoEm || !m.confirmacaoContratoPorId || !m.contratoDocumentoId || c.moeda !== m.moeda) throw new ErroRegra("Contrato e moeda precisam estar conferidos.");
  await tx.$queryRaw`SELECT id FROM "Documento" WHERE id = ${m.contratoDocumentoId} FOR SHARE`;
  if (!await tx.documento.count({ where: { id: m.contratoDocumentoId, arquivado: false, categoria: "CONTRATO", OR: [{ matriculaId }, ...(m.leadId ? [{ leadId: m.leadId }] : [])] } })) throw new ErroRegra("Contrato de origem indisponível.");
  const inicio = c.coberturaInicio.toISOString().slice(0, 10), fim = c.coberturaFim.toISOString().slice(0, 10);
  if (dias.some((d) => d < inicio || d > fim)) throw new ErroRegra("Os dias devem pertencer à cobertura original.");
  const apuracao = await apurarDiasIndisponibilidadeCoberturaTx(tx, {
    matriculaId,
    inicio: c.coberturaInicio,
    fim: c.coberturaFim,
  });
  if (apuracao.classificacao === "INTEGRAL") {
    throw new ErroRegra("Período inteiro com indisponibilidade confirmada exige o tratamento de crédito ou cobertura futura escolhido pelo aluno.");
  }
  const diasConfirmados = new Set(apuracao.diasConfirmados);
  if (dias.some((dia) => !diasConfirmados.has(dia))) {
    throw new ErroRegra("Todo dia de compensação precisa ter indisponibilidade de oferta confirmada.");
  }
  const existentes = await tx.diaCompensacaoCobertura.findMany({ where: { matriculaId, diaOrigem: { gte: c.coberturaInicio, lte: c.coberturaFim } }, select: { diaOrigem: true } });
  if (existentes.some((d) => dias.includes(d.diaOrigem.toISOString().slice(0, 10)))) throw new ErroRegra("Já existe direito de compensação para um dos dias.");
  const total = (c.coberturaFim.getTime() - c.coberturaInicio.getTime()) / 86_400_000 + 1;
  if (new Set([...dias, ...existentes.map((d) => d.diaOrigem.toISOString().slice(0, 10))]).size >= total) throw new ErroRegra("Período inteiro sem oferta exige o tratamento de crédito ou cobertura futura escolhido pelo aluno.");
  return { c, documentoId: m.contratoDocumentoId };
}

export async function prepararCompensacaoCobertura(input: z.input<typeof Preparar>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO); const parsed = Preparar.parse(input); const d = { ...parsed, dias: [...parsed.dias].sort() };
    const hash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`compensacao:${autor.id}:${d.chaveIdempotencia}`}, 0))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autor.id} FOR SHARE`;
      await exigirFinanceiro(tx, autor.id);
      const existente = await tx.compensacaoCoberturaMatricula.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (existente) { if (existente.entradaHash !== hash) throw new ErroRegra("Chave já utilizada com outra proposta."); return { id: existente.id, status: existente.status }; }
      await bloquearMatriculas(tx, [d.matriculaId]);
      await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id = ${d.cobrancaId} FOR UPDATE`;
      const { c, documentoId } = await fonte(tx, d.matriculaId, d.cobrancaId, d.dias);
      if (c.versao !== d.versaoCobranca) throw new ErroRegra("Cobrança alterada; confira novamente.");
      if (await tx.compensacaoCoberturaMatricula.count({ where: { cobrancaOrigemId: c.id, status: "PENDENTE" } })) throw new ErroRegra("Já existe compensação em análise para esta cobrança.");
      const p = await tx.compensacaoCoberturaMatricula.create({ data: { matriculaId: d.matriculaId, cobrancaOrigemId: c.id, preparadorId: autor.id, documentoOrigemId: documentoId,
        motivo: d.motivo, evidenciaCondicoes: d.evidenciaCondicoes, diasPropostos: d.dias, coberturaOriginalInicio: c.coberturaInicio!, coberturaOriginalFim: c.coberturaFim!,
        valorCoberturaOriginal: c.valorNegociado, moeda: c.moeda, cobrancaVersao: c.versao, chaveIdempotencia: d.chaveIdempotencia, entradaHash: hash } });
      await registrarEvento(tx, { tipo: "CompensacaoCoberturaPreparada", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id, payload: { compensacaoId: p.id, dias: d.dias } });
      return { id: p.id, status: p.status };
    });
  });
}

export async function decidirCompensacaoCobertura(input: { id: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = z.object({ id: z.string().min(1), aprovar: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const ref = await tx.compensacaoCoberturaMatricula.findUnique({ where: { id: d.id }, select: { matriculaId: true, cobrancaOrigemId: true } });
      if (!ref) throw new ErroRegra("Proposta não encontrada.");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await bloquearMatriculas(tx, [ref.matriculaId]);
      await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id = ${ref.cobrancaOrigemId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autor.id} FOR SHARE`;
      await exigirFinanceiro(tx, autor.id, true);
      const p = await tx.compensacaoCoberturaMatricula.findUniqueOrThrow({ where: { id: d.id } });
      if (p.preparadorId === autor.id) throw new ErroRegra("Outra pessoa deve decidir a compensação.");
      const status = d.aprovar ? "APROVADA" : "REJEITADA";
      if (p.status === status && p.decisorId === autor.id && p.motivoDecisao === d.motivo) return { id: p.id, status: p.status };
      if (p.status !== "PENDENTE") throw new ErroRegra("Proposta já decidida.");
      const dias = Dias.parse(p.diasPropostos);
      if (d.aprovar) {
        const { c, documentoId } = await fonte(tx, p.matriculaId, p.cobrancaOrigemId, dias);
        if (c.versao !== p.cobrancaVersao || documentoId !== p.documentoOrigemId || !c.valorNegociado.equals(p.valorCoberturaOriginal) || c.moeda !== p.moeda || c.coberturaInicio?.getTime() !== p.coberturaOriginalInicio.getTime() || c.coberturaFim?.getTime() !== p.coberturaOriginalFim.getTime()) throw new ErroRegra("Origem alterada; rejeite a proposta e prepare nova conferência.");
      }
      await tx.compensacaoCoberturaMatricula.update({ where: { id: p.id }, data: { status, decisorId: autor.id, motivoDecisao: d.motivo, decididaEm: new Date() } });
      if (d.aprovar) await tx.diaCompensacaoCobertura.createMany({ data: dias.map((dia) => ({ compensacaoId: p.id, matriculaId: p.matriculaId, diaOrigem: new Date(`${dia}T00:00:00Z`) })) });
      await registrarEvento(tx, { tipo: "CompensacaoCoberturaDecidida", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId: autor.id, payload: { compensacaoId: p.id, status, motivo: d.motivo } });
      return { id: p.id, status };
    });
  });
}
