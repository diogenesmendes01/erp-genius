"use server";

import { Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { carregarEstadoConferenciaFinalAditivoTx } from "./aditivo-conferencia-final-estado";
import { hashSubstituicao } from "./substituicao-estado";
import { CompletarImpactosTaxaAditivoSchema, DecidirImpactosTaxaAditivoSchema, PrepararImpactosTaxaAditivoSchema, VincularImpactoTaxaAditivoSchema } from "./aditivo-taxa-impactos-schema";

async function exigirFinanceiro(tx: Prisma.TransactionClient, id: string, aprovar = false) {
  const u = await tx.usuario.findUnique({ where: { id }, select: { ativo: true, papeis: true, permissoes: true } });
  if (!u?.ativo || !u.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR) || (aprovar && !u.papeis.includes(Papel.ADMINISTRADOR) && !u.permissoes.includes("financeiro.aprovar_acertos"))) throw new ErroPermissao("Exige Financeiro ativo e permissão vigente.");
}

function foto(c: { id: string; versao: number; valorNegociado: Prisma.Decimal; valorRecebido: Prisma.Decimal | null; valorLiquidadoCredito: Prisma.Decimal; saldo: Prisma.Decimal | null; vencimento: Date; status: string }) {
  return { cobranca: { id: c.id, versao: c.versao, valorNegociado: c.valorNegociado.toFixed(2), valorRecebido: c.valorRecebido?.toFixed(2) ?? null, valorLiquidadoCredito: c.valorLiquidadoCredito.toFixed(2), saldo: c.saldo?.toFixed(2) ?? null, vencimento: c.vencimento.toISOString().slice(0, 10), status: c.status } };
}

async function revalidarFotografiaConjunto(tx: Prisma.TransactionClient, conjunto: { matriculaId: string; propostaAditivoId: string; conferenciaFinalId: string; versaoCondicoesId: string; fotografia: Prisma.JsonValue; fotografiaHash: string; impactos: Array<{ cobrancaId: string; decisao: string; justificativa: string; fotografiaHash: string; propostaAcerto?: { aplicacao: { versaoAnterior: number; valorNovo: Prisma.Decimal; vencimentoNovo: Date } | null } | null }> }) {
  const versao = await tx.versaoCondicoesAditivo.findUniqueOrThrow({ where: { id: conjunto.versaoCondicoesId }, select: { propostaId: true, conferenciaFinalId: true, condicoesHash: true } });
  if (versao.propostaId !== conjunto.propostaAditivoId || versao.conferenciaFinalId !== conjunto.conferenciaFinalId) throw new ErroRegra("A fotografia do conjunto não pertence mais à versão formalizada.");
  const ids = conjunto.impactos.map(i => i.cobrancaId).sort();
  await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id = ANY(${ids}::text[]) ORDER BY id FOR UPDATE`;
  const cobrancas = await tx.cobranca.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" } });
  if (cobrancas.length !== ids.length || cobrancas.some(c => c.matriculaId !== conjunto.matriculaId || c.tipo !== "MATRICULA")) throw new ErroRegra("A fotografia contém taxa fora da matrícula.");
  for (const impacto of conjunto.impactos) {
    const cobranca = cobrancas.find(c => c.id === impacto.cobrancaId)!;
    if (hashSubstituicao(foto(cobranca)) !== impacto.fotografiaHash) {
      const aplicacao = impacto.propostaAcerto?.aplicacao;
      const aplicadaConformeProposta = Boolean(aplicacao && cobranca.versao === aplicacao.versaoAnterior + 1 && cobranca.valorNegociado.eq(aplicacao.valorNovo) && cobranca.vencimento.toISOString().slice(0, 10) === aplicacao.vencimentoNovo.toISOString().slice(0, 10));
      if (!aplicadaConformeProposta) throw new ErroRegra("Uma taxa mudou após o preparo; prepare novamente o conjunto.");
    }
  }
}

export async function prepararImpactosTaxaAditivo(input: unknown) { return executarAcao(async () => {
  const autor = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR), d = PrepararImpactosTaxaAditivoSchema.parse(input);
  return prisma.$transaction(async tx => {
    await exigirFinanceiro(tx, autor.id); await bloquearMatriculas(tx, [d.matriculaId]);
    const estado = await carregarEstadoConferenciaFinalAditivoTx(tx, d);
    if (estado.revisaoHash !== d.revisaoHash || estado.dados.ambiente !== "PRODUCAO") throw new ErroRegra("A conclusão em produção e sua revisão exata são obrigatórias.");
    const versao = await tx.versaoCondicoesAditivo.findFirst({ where: { matriculaId: d.matriculaId, propostaId: d.propostaId, conferenciaFinal: { conclusaoId: d.conclusaoId } } });
    if (!versao) throw new ErroRegra("Formalize as condições antes de preparar os impactos da taxa.");
    const condicoes = versao.condicoes as Record<string, unknown>;
    const taxaValor = condicoes.TAXA_VALOR as { tipo?: string; moeda?: string } | undefined;
    const taxaVencimento = condicoes.TAXA_VENCIMENTO as { tipo?: string } | undefined;
    if (!taxaValor && !taxaVencimento) throw new ErroRegra("O conjunto exige alteração explícita de TAXA_VALOR ou TAXA_VENCIMENTO.");
    if (taxaValor && (taxaValor.tipo !== "DINHEIRO" || typeof taxaValor.moeda !== "string")) throw new ErroRegra("A alteração de valor da taxa está inválida.");
    if (taxaVencimento && taxaVencimento.tipo !== "DATA") throw new ErroRegra("A alteração de vencimento da taxa está inválida.");
    const cobrancas = await tx.cobranca.findMany({ where: { matriculaId: d.matriculaId, tipo: "MATRICULA" }, orderBy: [{ vencimento: "asc" }, { id: "asc" }] });
    if (cobrancas.length !== d.linhas.length || new Set(d.linhas.map(l => l.cobrancaId)).size !== cobrancas.length || cobrancas.some(c => !d.linhas.some(l => l.cobrancaId === c.id))) throw new ErroRegra("Declare todas as taxas existentes, afetadas ou preservadas.");
    const linhas = d.linhas.map(l => { const c = cobrancas.find(x => x.id === l.cobrancaId)!; const fotografia = foto(c); return { ...l, fotografia, fotografiaHash: hashSubstituicao(fotografia) }; });
    const fotografia = { revisaoHash: d.revisaoHash, condicoesHash: versao.condicoesHash, versaoCondicoesId: versao.id, cobrancas: linhas.map(l => ({ id: l.cobrancaId, decisao: l.decisao, justificativa: l.justificativa, fotografiaHash: l.fotografiaHash })) };
    const fotografiaHash = hashSubstituicao(fotografia);
    const anterior = await tx.conjuntoImpactosTaxaAditivo.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
    if (anterior) {
      const entrada = anterior.fotografia as { revisaoHash?: string; cobrancas?: Array<{ id: string; decisao: string; justificativa: string }> };
      const recebida = [...d.linhas].sort((a, b) => a.cobrancaId.localeCompare(b.cobrancaId));
      const preservada = [...(entrada.cobrancas ?? [])].map(l => ({ cobrancaId: l.id, decisao: l.decisao, justificativa: l.justificativa })).sort((a, b) => a.cobrancaId.localeCompare(b.cobrancaId));
      if (anterior.matriculaId !== d.matriculaId || anterior.propostaAditivoId !== d.propostaId || entrada.revisaoHash !== d.revisaoHash || JSON.stringify(preservada) !== JSON.stringify(recebida)) throw new ErroRegra("Chave já usada com outro conjunto.");
      return { id: anterior.id, status: anterior.status };
    }
    const conjunto = await tx.conjuntoImpactosTaxaAditivo.create({ data: { matriculaId: d.matriculaId, propostaAditivoId: d.propostaId, conferenciaFinalId: versao.conferenciaFinalId, versaoCondicoesId: versao.id, preparadorId: autor.id, fotografia, fotografiaHash, chaveIdempotencia: d.chaveIdempotencia, impactos: { create: linhas.map(l => ({ cobrancaId: l.cobrancaId, decisao: l.decisao, justificativa: l.justificativa, fotografia: l.fotografia, fotografiaHash: l.fotografiaHash })) } } });
    await registrarEvento(tx, { tipo: "ImpactosTaxaAditivoPreparados", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id, payload: { conjuntoId: conjunto.id, propostaId: d.propostaId, fotografiaHash } });
    return { id: conjunto.id, status: conjunto.status };
  });
}); }

export async function decidirImpactosTaxaAditivo(input: unknown) { return executarAcao(async () => {
  const autor = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR), d = DecidirImpactosTaxaAditivoSchema.parse(input);
  return prisma.$transaction(async tx => { await exigirFinanceiro(tx, autor.id, true); const referencia = await tx.conjuntoImpactosTaxaAditivo.findUniqueOrThrow({ where: { id: d.conjuntoId }, select: { matriculaId: true } }); await bloquearMatriculas(tx, [referencia.matriculaId]); const c = await tx.conjuntoImpactosTaxaAditivo.findUniqueOrThrow({ where: { id: d.conjuntoId }, include: { decisao: true, impactos: { include: { propostaAcerto: { include: { aplicacao: true } } } } } }); if (c.preparadorId === autor.id) throw new ErroRegra("A decisão exige outro Financeiro."); if (c.decisao) { if (c.decisao.decisorId !== autor.id || c.decisao.aprovada !== d.aprovada || c.decisao.motivo !== d.motivo || c.decisao.chaveIdempotencia !== d.chaveIdempotencia) throw new ErroRegra("O conjunto já recebeu outra decisão."); return { id: c.decisao.id, aprovada: c.decisao.aprovada }; } if (d.aprovada) await revalidarFotografiaConjunto(tx, c); const decisao = await tx.decisaoConjuntoImpactosTaxaAditivo.create({ data: { conjuntoId: c.id, decisorId: autor.id, aprovada: d.aprovada, motivo: d.motivo, fotografiaHash: c.fotografiaHash, chaveIdempotencia: d.chaveIdempotencia } }); await tx.conjuntoImpactosTaxaAditivo.update({ where: { id: c.id }, data: { status: d.aprovada ? "APROVADO" : "REJEITADO" } }); await registrarEvento(tx, { tipo: d.aprovada ? "ImpactosTaxaAditivoAprovados" : "ImpactosTaxaAditivoRejeitados", agregadoTipo: "Matricula", agregadoId: c.matriculaId, autorId: autor.id, payload: { conjuntoId: c.id, decisaoId: decisao.id, fotografiaHash: c.fotografiaHash } }); return { id: decisao.id, aprovada: decisao.aprovada }; });
}); }

export async function vincularImpactoTaxaAditivo(input: unknown) { return executarAcao(async () => {
  const autor = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR), d = VincularImpactoTaxaAditivoSchema.parse(input);
  return prisma.$transaction(async tx => {
    await exigirFinanceiro(tx, autor.id); const conjunto = await tx.conjuntoImpactosTaxaAditivo.findUniqueOrThrow({ where: { id: d.conjuntoId } }); await bloquearMatriculas(tx, [conjunto.matriculaId]);
    const linha = await tx.impactoTaxaAditivo.findUniqueOrThrow({ where: { conjuntoId_cobrancaId: { conjuntoId: d.conjuntoId, cobrancaId: d.cobrancaId } } });
    if (linha.propostaAcertoId === d.propostaAcertoId) return { id: linha.id, vinculada: true };
    if (linha.decisao !== "AFETADA" || linha.propostaAcertoId) throw new ErroRegra("Somente taxa afetada sem vínculo pode receber acerto.");
    const proposta = await tx.propostaAcertoTaxaAditivo.findUniqueOrThrow({ where: { id: d.propostaAcertoId } });
    if (proposta.matriculaId !== conjunto.matriculaId || proposta.propostaAditivoId !== conjunto.propostaAditivoId || proposta.versaoCondicoesId !== conjunto.versaoCondicoesId || proposta.cobrancaId !== linha.cobrancaId) throw new ErroRegra("O acerto não corresponde à taxa e versão deste conjunto.");
    await tx.impactoTaxaAditivo.update({ where: { id: linha.id }, data: { propostaAcertoId: proposta.id } });
    await registrarEvento(tx, { tipo: "ImpactoTaxaAditivoVinculado", agregadoTipo: "Matricula", agregadoId: conjunto.matriculaId, autorId: autor.id, payload: { conjuntoId: conjunto.id, cobrancaId: linha.cobrancaId, propostaAcertoId: proposta.id } });
    return { id: linha.id, vinculada: true };
  });
}); }

export async function completarImpactosTaxaAditivo(input: unknown) { return executarAcao(async () => {
  const autor = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR), d = CompletarImpactosTaxaAditivoSchema.parse(input);
  return prisma.$transaction(async tx => {
    await exigirFinanceiro(tx, autor.id, true); const conjunto = await tx.conjuntoImpactosTaxaAditivo.findUniqueOrThrow({ where: { id: d.conjuntoId }, include: { decisao: true, impactos: { include: { propostaAcerto: { include: { aplicacao: true } } } } } }); await bloquearMatriculas(tx, [conjunto.matriculaId]);
    if (conjunto.status === "COMPLETO") return { id: conjunto.id, completo: true };
    if (conjunto.status !== "APROVADO" || !conjunto.decisao?.aprovada || conjunto.decisao.fotografiaHash !== conjunto.fotografiaHash) throw new ErroRegra("O conjunto precisa estar aprovado com sua fotografia vigente antes da conclusão.");
    await revalidarFotografiaConjunto(tx, conjunto);
    if (conjunto.impactos.some(i => i.decisao === "AFETADA" && !i.propostaAcerto?.aplicacao)) throw new ErroRegra("Há taxas afetadas sem acerto aplicado.");
    await tx.conjuntoImpactosTaxaAditivo.update({ where: { id: conjunto.id }, data: { status: "COMPLETO" } });
    await registrarEvento(tx, { tipo: "ImpactosTaxaAditivoCompletos", agregadoTipo: "Matricula", agregadoId: conjunto.matriculaId, autorId: autor.id, payload: { conjuntoId: conjunto.id, propostaId: conjunto.propostaAditivoId, versaoCondicoesId: conjunto.versaoCondicoesId, fotografiaHash: conjunto.fotografiaHash } });
    return { id: conjunto.id, completo: true };
  });
}); }

export async function consultarImpactosTaxaAditivo(propostaId: string) { return executarAcao(async () => {
  await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR, Papel.SECRETARIA_ACADEMICA);
  const conjunto = await prisma.conjuntoImpactosTaxaAditivo.findFirst({ where: { propostaAditivoId: propostaId }, orderBy: { criadaEm: "desc" }, include: { impactos: { include: { cobranca: { select: { codigo: true } }, propostaAcerto: { include: { aplicacao: { select: { id: true } } } } } } } });
  if (!conjunto) return null;
  return { id: conjunto.id, status: conjunto.status, aplicado: conjunto.status === "COMPLETO", impactos: conjunto.impactos.map(i => ({ cobrancaId: i.cobrancaId, codigo: i.cobranca.codigo, decisao: i.decisao, justificativa: i.justificativa, aplicado: Boolean(i.propostaAcerto?.aplicacao) })) };
}); }
