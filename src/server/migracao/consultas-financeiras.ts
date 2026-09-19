"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { carregarTrilhasVencimentoCivil, incluirFonteVencimentoCivil, referenciaVencimentoCivil } from "@/server/financeiro/vencimento-civil";

const entrada = z.object({ linhaId: z.string().min(1).max(100), cursor: z.string().min(1).max(100).optional(), cursorRecebimentos: z.string().min(1).max(100).optional(), cursorPagadores: z.string().min(1).max(100).optional(), cursorPropostas: z.string().min(1).max(100).optional() }).strict();
const porPagina = 20;

async function usuarioFinanceiroFresco(tx: Prisma.TransactionClient, usuarioId: string) {
  const [usuario] = await tx.$queryRaw<{ ativo: boolean; papeis: Papel[] }[]>(Prisma.sql`SELECT ativo, papeis FROM "Usuario" WHERE id=${usuarioId} FOR SHARE`);
  if (!usuario?.ativo || !usuario.papeis.some((papel) => papel === Papel.ADMINISTRADOR || papel === Papel.FINANCEIRO)) {
    throw new ErroPermissao("Sua permissão financeira mudou; atualize a página.");
  }
}

const decimal = (valor: { toString(): string } | null) => valor?.toString() ?? null;
const data = (valor: Date | null) => valor?.toISOString() ?? null;

/**
 * Consulta restrita ao contrato que já possui mapa M01 para a linha financeira.
 * IDs são retornados apenas para opções controladas da interface; a ação revalida
 * toda associação no servidor antes de propor ou decidir.
 */
export async function consultarConciliacaoFinanceiraMigracao(input: { linhaId: string; cursor?: string; cursorRecebimentos?: string; cursorPagadores?: string; cursorPropostas?: string }) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.ADMINISTRADOR, Papel.FINANCEIRO);
    const filtro = entrada.parse(input);
    return prisma.$transaction(async (tx) => {
      await usuarioFinanceiroFresco(tx, sessao.id);
      const linha = await tx.linhaPreparacaoMigracao.findUnique({
        where: { id: filtro.linhaId },
        select: {
          id: true, linhaOrigem: true, tipoEntrada: true, financeiroOrigemId: true, matriculaOrigemId: true,
          dadosOrigem: true, entradaHash: true, lote: { select: { origem: true, chaveLote: true } },
        },
      });
      if (!linha || linha.tipoEntrada !== "FINANCEIRO_HISTORICO" || !linha.financeiroOrigemId || !linha.matriculaOrigemId) return null;

      const mapa = await tx.mapaOrigemMatriculaMigracao.findUnique({
        where: { origem_matriculaOrigemId: { origem: linha.lote.origem, matriculaOrigemId: linha.matriculaOrigemId } },
        select: {
          matriculaId: true, entradaHash: true,
          matricula: { select: { codigo: true, status: true, moeda: true, aluno: { select: { primeiroNome: true, sobrenome: true } } } },
        },
      });
      if (!mapa) return { linha: { ...linha, mapa: null }, cobrancas: [], recebimentos: [], pagadores: [], propostas: [], proximoCursor: null, proximoCursorRecebimentos: null, proximoCursorPagadores: null, proximoCursorPropostas: null, podeDecidir: false };

      const aplicacoesOrigem = await tx.conciliacaoFinanceiraMigracao.findMany({
        where: { origem: linha.lote.origem, financeiroOrigemId: linha.financeiroOrigemId },
        select: { recebimentoId: true, aplicadaEm: true },
      });
      const recebida = aplicacoesOrigem.find(aplicacao => aplicacao.recebimentoId !== null);
      const cursores = await Promise.all([
        filtro.cursor ? tx.cobranca.findFirst({ where: { id: filtro.cursor, matriculaId: mapa.matriculaId }, select: { id: true } }) : true,
        filtro.cursorRecebimentos ? tx.recebimento.findFirst({ where: { id: filtro.cursorRecebimentos, titularMatriculaId: mapa.matriculaId }, select: { id: true } }) : true,
        filtro.cursorPagadores ? tx.pagadorPreparacaoMatricula.findFirst({ where: { id: filtro.cursorPagadores, matriculaId: mapa.matriculaId }, select: { id: true } }) : true,
        filtro.cursorPropostas ? tx.propostaConciliacaoFinanceiraMigracao.findFirst({ where: { id: filtro.cursorPropostas, linhaId: linha.id }, select: { id: true } }) : true,
      ]);
      if (cursores.some(cursor => !cursor)) throw new ErroRegra("Página inválida para este contrato; retorne ao início da consulta.");
      const cobrancas = await tx.cobranca.findMany({
        where: { matriculaId: mapa.matriculaId, ...(filtro.cursor ? { id: { gt: filtro.cursor } } : {}) },
        orderBy: { id: "asc" }, take: porPagina + 1,
        include: { ...incluirFonteVencimentoCivil },
      });
      const pagina = cobrancas.slice(0, porPagina);
      const trilhasVencimento = await carregarTrilhasVencimentoCivil(tx, pagina.map((c) => c.id), [mapa.matriculaId]);
      const recebimentos = await tx.recebimento.findMany({
        where: { titularMatriculaId: mapa.matriculaId }, orderBy: { id: "asc" }, take: porPagina + 1, ...(filtro.cursorRecebimentos ? { cursor: { id: filtro.cursorRecebimentos }, skip: 1 } : {}),
        select: { id: true, cobrancaId: true, valor: true, moeda: true, forma: true, dataPagamento: true, chaveIdempotencia: true, hashDados: true, autorId: true, destinacoes: { where: { tipo: "COBRANCA" }, orderBy: { id: "asc" }, select: { id: true, cobrancaId: true, valor: true } } },
      });
      const pagadores = await tx.pagadorPreparacaoMatricula.findMany({
        where: { matriculaId: mapa.matriculaId }, orderBy: { versao: "desc" }, take: porPagina + 1, ...(filtro.cursorPagadores ? { cursor: { id: filtro.cursorPagadores }, skip: 1 } : {}),
        select: { id: true, versao: true, tipo: true, dados: true, motivo: true, criadaEm: true, preparador: { select: { nome: true } } },
      });
      const propostas = await tx.propostaConciliacaoFinanceiraMigracao.findMany({
        where: { linhaId: linha.id }, orderBy: { versao: "desc" }, take: porPagina + 1, ...(filtro.cursorPropostas ? { cursor: { id: filtro.cursorPropostas }, skip: 1 } : {}),
        select: {
          id: true, versao: true, modalidade: true, valor: true, moeda: true, dataPagamento: true, forma: true, status: true,
          evidencia: true, complemento: true, snapshot: true, estadoHash: true, motivoDecisao: true, decididoEm: true, aplicadaEm: true, criadoEm: true,
          preparadorId: true, preparador: { select: { nome: true } }, decisor: { select: { nome: true } },
          cobranca: { select: { codigo: true, moeda: true, status: true } },
          pagador: { select: { versao: true, tipo: true } },
          recebimentoExistente: { select: { id: true, dataPagamento: true } },
          aplicacao: { select: { recebimentoId: true, aplicadaEm: true, aplicadaPor: { select: { nome: true } } } },
        },
      });
      return {
        linha: { ...linha, mapa: { matriculaId: mapa.matriculaId, entradaHash: mapa.entradaHash, codigo: mapa.matricula.codigo, status: mapa.matricula.status, moeda: mapa.matricula.moeda, aluno: `${mapa.matricula.aluno.primeiroNome} ${mapa.matricula.aluno.sobrenome}` } },
        pendenciaRegistrada: aplicacoesOrigem.some(aplicacao => aplicacao.recebimentoId === null),
        resolucao: recebida ? { recebimentoId: recebida.recebimentoId!, aplicadaEm: recebida.aplicadaEm.toISOString() } : null,
        cobrancas: pagina.map((cobranca) => {
          const { aplicacoesAcertoTaxaAditivo, itemEmissaoEntrada, emissaoContinuidadeGerada, emissaoFechamentoHoras, ...visivel } = cobranca;
          return {
            ...visivel,
            valorNegociado: cobranca.valorNegociado.toString(), valorRecebido: decimal(cobranca.valorRecebido), saldo: decimal(cobranca.saldo),
            vencimento: referenciaVencimentoCivil({ ...cobranca, aplicacoesAditivoVencimento: trilhasVencimento.vencimentosPorCobranca.get(cobranca.id), aplicacoesM01: trilhasVencimento.m01PorCobranca.get(cobranca.id), retomadasReprogramadas: trilhasVencimento.retomadasReprogramadas }),
          };
        }),
        recebimentos: recebimentos.slice(0, porPagina).map((recebimento) => ({ ...recebimento, destinacoes: recebimento.destinacoes.map(destino => ({ ...destino, valor: destino.valor.toString() })), valor: recebimento.valor.toString(), dataPagamento: recebimento.dataPagamento.toISOString() })),
        pagadores: pagadores.slice(0, porPagina).map((pagador) => ({ ...pagador, criadaEm: pagador.criadaEm.toISOString() })),
        propostas: propostas.slice(0, porPagina).map((proposta) => ({ ...proposta, podeDecidir: proposta.status === "PENDENTE" && proposta.preparadorId !== sessao.id, valor: decimal(proposta.valor), dataPagamento: data(proposta.dataPagamento), decididoEm: data(proposta.decididoEm), aplicadaEm: data(proposta.aplicadaEm), criadoEm: proposta.criadoEm.toISOString(), recebimentoExistente: proposta.recebimentoExistente ? { ...proposta.recebimentoExistente, dataPagamento: proposta.recebimentoExistente.dataPagamento.toISOString() } : null, aplicacao: proposta.aplicacao ? { ...proposta.aplicacao, aplicadaEm: proposta.aplicacao.aplicadaEm.toISOString() } : null })),
        proximoCursor: cobrancas.length > porPagina ? pagina.at(-1)!.id : null,
        proximoCursorRecebimentos: recebimentos.length > porPagina ? recebimentos[porPagina - 1]!.id : null,
        proximoCursorPagadores: pagadores.length > porPagina ? pagadores[porPagina - 1]!.id : null,
        proximoCursorPropostas: propostas.length > porPagina ? propostas[porPagina - 1]!.id : null,
        podeDecidir: true,
      };
    });
  });
}
/** Fila financeira própria: não concede acesso aos lotes administrativos completos. */
export async function listarLinhasConciliacaoFinanceira(input: { cursor?: string } = {}) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.ADMINISTRADOR, Papel.FINANCEIRO);
    const filtro = z.object({ cursor: z.string().min(1).max(100).optional() }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await usuarioFinanceiroFresco(tx, sessao.id);
      if (filtro.cursor && !await tx.linhaPreparacaoMigracao.findFirst({ where: { id: filtro.cursor, tipoEntrada: "FINANCEIRO_HISTORICO" }, select: { id: true } })) throw new ErroRegra("Página de conciliação inválida.");
      const linhas = await tx.linhaPreparacaoMigracao.findMany({
        where: { tipoEntrada: "FINANCEIRO_HISTORICO", ...(filtro.cursor ? { id: { gt: filtro.cursor } } : {}) },
        orderBy: { id: "asc" }, take: porPagina + 1,
        select: { id: true, linhaOrigem: true, matriculaOrigemId: true, financeiroOrigemId: true, estado: true, lote: { select: { origem: true, chaveLote: true } },
          propostasConciliacaoFinanceira: { orderBy: { versao: "desc" }, take: 1, select: { status: true, versao: true } } },
      });
      const itens = linhas.slice(0, porPagina);
      return { itens, proximoCursor: linhas.length > porPagina ? itens.at(-1)!.id : null };
    });
  });
}
