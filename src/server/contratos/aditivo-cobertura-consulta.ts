"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";

const EntradaSchema = z.object({ matriculaId: z.string().trim().min(1).max(100), propostaId: z.string().trim().min(1).max(100) }).strict();
const PaginaSchema = z.object({ pagina: z.number().int().min(1).max(100000) }).strict();

async function capacidades() {
  const sessao = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR, Papel.SECRETARIA_ACADEMICA);
  const usuario = await prisma.usuario.findUnique({ where: { id: sessao.id }, select: { ativo: true, papeis: true, permissoes: true } });
  const financeiro = Boolean(usuario?.ativo && usuario.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR));
  return { sessao, financeiro, aprova: financeiro && Boolean(usuario?.papeis.includes(Papel.ADMINISTRADOR) || usuario?.permissoes.includes("financeiro.aprovar_acertos")) };
}

export async function consultarImpactosCoberturaAditivo(input: unknown) { return executarAcao(async () => {
  const d = EntradaSchema.parse(input), { sessao, financeiro, aprova } = await capacidades();
  const incluir = { decisao: { select: { aprovada: true, decisorId: true, decididaEm: true } }, impactos: { include: { cobranca: { select: { id: true, codigo: true, moeda: true, coberturaInicio: true, coberturaFim: true, vencimento: true, status: true, versao: true } }, aplicacao: { select: { id: true } } } } } as const;
  const conjunto = await prisma.conjuntoImpactosCoberturaAditivo.findFirst({ where: { matriculaId: d.matriculaId, propostaAditivoId: d.propostaId, status: { in: ["PENDENTE", "APROVADO", "COMPLETO"] } }, orderBy: { criadaEm: "desc" }, include: incluir }) ?? await prisma.conjuntoImpactosCoberturaAditivo.findFirst({ where: { matriculaId: d.matriculaId, propostaAditivoId: d.propostaId }, orderBy: { criadaEm: "desc" }, include: incluir });
  if (!conjunto) return null;
  const impactos = conjunto.impactos.map(i => ({ cobrancaId: i.cobrancaId, classificacao: i.classificacao, justificativa: i.justificativa, aplicado: Boolean(i.aplicacao), cobranca: { id: i.cobranca.id, codigo: i.cobranca.codigo, moeda: i.cobranca.moeda, vencimento: i.cobranca.vencimento.toISOString().slice(0, 10), coberturaInicio: i.cobranca.coberturaInicio?.toISOString().slice(0, 10) ?? null, coberturaFim: i.cobranca.coberturaFim?.toISOString().slice(0, 10) ?? null, status: i.cobranca.status, versao: i.cobranca.versao }, coberturaInicioNova: i.coberturaInicioNova?.toISOString().slice(0, 10) ?? null, coberturaFimNova: i.coberturaFimNova?.toISOString().slice(0, 10) ?? null }));
  const afetadas = impactos.filter(i => i.classificacao === "AFETADA");
  return { id: conjunto.id, status: conjunto.status, decisao: conjunto.decisao && { aprovada: conjunto.decisao.aprovada, decisorId: conjunto.decisao.decisorId, decididaEm: conjunto.decisao.decididaEm.toISOString() }, impactos, pendencias: { afetadasSemAplicacao: afetadas.filter(i => !i.aplicado).length }, podeDecidir: aprova && conjunto.status === "PENDENTE" && !conjunto.decisao && conjunto.preparadorId !== sessao.id, podeAplicar: aprova && conjunto.status === "APROVADO" && conjunto.decisao?.aprovada === true && conjunto.decisao.decisorId === sessao.id && conjunto.preparadorId !== sessao.id, podeObsoletar: financeiro && ["PENDENTE", "APROVADO"].includes(conjunto.status) };
}); }

export async function consultarPreparoCoberturaAditivo(input: unknown) { return executarAcao(async () => {
  const d = EntradaSchema.parse(input), { financeiro } = await capacidades();
  if (!financeiro) return { estado: "SEM_ALCADA" as const, mensagem: "A preparação de cobertura exige Financeiro ou Administração." };
  const versao = await prisma.versaoCondicoesAditivo.findFirst({ where: { matriculaId: d.matriculaId, propostaId: d.propostaId }, include: { conferenciaFinal: { select: { conclusaoId: true, revisaoHash: true } } } });
  const condicoes = versao?.condicoes as Record<string, unknown> | undefined;
  if (!versao || !condicoes?.COBERTURA_INICIO || !condicoes.COBERTURA_FIM) return { estado: "SEM_COBERTURA" as const, mensagem: "Este aditivo não formaliza a correção dos limites de cobertura." };
  const cobrancas = await prisma.cobranca.findMany({ where: { matriculaId: d.matriculaId, tipo: "MENSALIDADE" }, orderBy: [{ coberturaInicio: "asc" }, { id: "asc" }], select: { id: true, codigo: true, moeda: true, vencimento: true, coberturaInicio: true, coberturaFim: true } });
  return { estado: "PRONTA" as const, conclusaoId: versao.conferenciaFinal.conclusaoId, revisaoHash: versao.conferenciaFinal.revisaoHash, cobrancas: cobrancas.map(c => ({ ...c, vencimento: c.vencimento.toISOString().slice(0, 10), coberturaInicio: c.coberturaInicio?.toISOString().slice(0, 10) ?? null, coberturaFim: c.coberturaFim?.toISOString().slice(0, 10) ?? null })) };
}); }

export async function listarAditivosParaCobertura(pagina: number) { return executarAcao(async () => {
  PaginaSchema.parse({ pagina });
  await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
  const versoes = await prisma.versaoCondicoesAditivo.findMany({ orderBy: [{ registradaEm: "desc" }, { id: "desc" }], select: { matriculaId: true, propostaId: true, versao: true, condicoes: true } });
  const inicio = (pagina - 1) * 20, itens = versoes.filter(v => Boolean((v.condicoes as Record<string, unknown>).COBERTURA_INICIO)).slice(inicio, inicio + 21);
  return { itens: itens.slice(0, 20).map(({ matriculaId, propostaId, versao }) => ({ matriculaId, propostaId, versao })), temProxima: itens.length > 20 };
}); }
