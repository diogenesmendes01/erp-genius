"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { janelaDaPagina, PAGINA_MAXIMA, recorteDaPagina } from "@/lib/pagina-url";
import { ErroPermissao, executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { carregarTrilhasVencimentoCivil, incluirFonteVencimentoCivil, referenciaVencimentoCivil } from "@/server/financeiro/vencimento-civil";

const Pagina = z.number().int().min(1).max(PAGINA_MAXIMA).optional();
const entrada = z.object({ linhaId: z.string().min(1).max(100), pagina: Pagina, paginaRecebimentos: Pagina, paginaPagadores: Pagina, paginaPropostas: Pagina }).strict();
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
 *
 * Cada coleção tem a própria página numerada (E4): a ordem termina no id, então a
 * mesma página lida na ida e na volta traz os mesmos registros, e a página de uma
 * coleção não muda as outras.
 */
export async function consultarConciliacaoFinanceiraMigracao(input: { linhaId: string; pagina?: number; paginaRecebimentos?: number; paginaPagadores?: number; paginaPropostas?: number }) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.ADMINISTRADOR, Papel.FINANCEIRO);
    const filtro = entrada.parse(input);
    const paginas = { pagina: filtro.pagina ?? 1, paginaRecebimentos: filtro.paginaRecebimentos ?? 1, paginaPagadores: filtro.paginaPagadores ?? 1, paginaPropostas: filtro.paginaPropostas ?? 1 };
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
      if (!mapa) return { linha: { ...linha, mapa: null }, cobrancas: [], recebimentos: [], pagadores: [], propostas: [], ...paginas, temProxima: false, temProximaRecebimentos: false, temProximaPagadores: false, temProximaPropostas: false, podeDecidir: false };

      const aplicacoesOrigem = await tx.conciliacaoFinanceiraMigracao.findMany({
        where: { origem: linha.lote.origem, financeiroOrigemId: linha.financeiroOrigemId },
        select: { recebimentoId: true, aplicadaEm: true },
      });
      const recebida = aplicacoesOrigem.find(aplicacao => aplicacao.recebimentoId !== null);
      const cobrancasLidas = await tx.cobranca.findMany({
        where: { matriculaId: mapa.matriculaId },
        orderBy: { id: "asc" }, ...janelaDaPagina(paginas.pagina, porPagina),
        include: { ...incluirFonteVencimentoCivil },
      });
      const cobrancas = recorteDaPagina(cobrancasLidas, porPagina);
      const trilhasVencimento = await carregarTrilhasVencimentoCivil(tx, cobrancas.registros.map((c) => c.id), [mapa.matriculaId]);
      const recebimentos = recorteDaPagina(await tx.recebimento.findMany({
        where: { titularMatriculaId: mapa.matriculaId }, orderBy: { id: "asc" }, ...janelaDaPagina(paginas.paginaRecebimentos, porPagina),
        select: { id: true, cobrancaId: true, valor: true, moeda: true, forma: true, dataPagamento: true, chaveIdempotencia: true, hashDados: true, autorId: true, destinacoes: { where: { tipo: "COBRANCA" }, orderBy: { id: "asc" }, select: { id: true, cobrancaId: true, valor: true } } },
      }), porPagina);
      const pagadores = recorteDaPagina(await tx.pagadorPreparacaoMatricula.findMany({
        where: { matriculaId: mapa.matriculaId }, orderBy: [{ versao: "desc" }, { id: "desc" }], ...janelaDaPagina(paginas.paginaPagadores, porPagina),
        select: { id: true, versao: true, tipo: true, dados: true, motivo: true, criadaEm: true, preparador: { select: { nome: true } } },
      }), porPagina);
      const propostas = recorteDaPagina(await tx.propostaConciliacaoFinanceiraMigracao.findMany({
        where: { linhaId: linha.id }, orderBy: [{ versao: "desc" }, { id: "desc" }], ...janelaDaPagina(paginas.paginaPropostas, porPagina),
        select: {
          id: true, versao: true, modalidade: true, valor: true, moeda: true, dataPagamento: true, forma: true, status: true,
          evidencia: true, complemento: true, snapshot: true, estadoHash: true, motivoDecisao: true, decididoEm: true, aplicadaEm: true, criadoEm: true,
          preparadorId: true, preparador: { select: { nome: true } }, decisor: { select: { nome: true } },
          cobranca: { select: { codigo: true, moeda: true, status: true } },
          pagador: { select: { versao: true, tipo: true } },
          recebimentoExistente: { select: { id: true, dataPagamento: true } },
          aplicacao: { select: { recebimentoId: true, aplicadaEm: true, aplicadaPor: { select: { nome: true } } } },
        },
      }), porPagina);
      return {
        linha: { ...linha, mapa: { matriculaId: mapa.matriculaId, entradaHash: mapa.entradaHash, codigo: mapa.matricula.codigo, status: mapa.matricula.status, moeda: mapa.matricula.moeda, aluno: `${mapa.matricula.aluno.primeiroNome} ${mapa.matricula.aluno.sobrenome}` } },
        pendenciaRegistrada: aplicacoesOrigem.some(aplicacao => aplicacao.recebimentoId === null),
        resolucao: recebida ? { recebimentoId: recebida.recebimentoId!, aplicadaEm: recebida.aplicadaEm.toISOString() } : null,
        cobrancas: cobrancas.registros.map((cobranca) => {
          const { aplicacoesAcertoTaxaAditivo, itemEmissaoEntrada, emissaoContinuidadeGerada, emissaoFechamentoHoras, ...visivel } = cobranca;
          return {
            ...visivel,
            valorNegociado: cobranca.valorNegociado.toString(), valorRecebido: decimal(cobranca.valorRecebido), saldo: decimal(cobranca.saldo),
            vencimento: referenciaVencimentoCivil({ ...cobranca, aplicacoesAditivoVencimento: trilhasVencimento.vencimentosPorCobranca.get(cobranca.id), aplicacoesM01: trilhasVencimento.m01PorCobranca.get(cobranca.id), retomadasReprogramadas: trilhasVencimento.retomadasReprogramadas }),
          };
        }),
        recebimentos: recebimentos.registros.map((recebimento) => ({ ...recebimento, destinacoes: recebimento.destinacoes.map(destino => ({ ...destino, valor: destino.valor.toString() })), valor: recebimento.valor.toString(), dataPagamento: recebimento.dataPagamento.toISOString() })),
        pagadores: pagadores.registros.map((pagador) => ({ ...pagador, criadaEm: pagador.criadaEm.toISOString() })),
        propostas: propostas.registros.map((proposta) => ({ ...proposta, podeDecidir: proposta.status === "PENDENTE" && proposta.preparadorId !== sessao.id, valor: decimal(proposta.valor), dataPagamento: data(proposta.dataPagamento), decididoEm: data(proposta.decididoEm), aplicadaEm: data(proposta.aplicadaEm), criadoEm: proposta.criadoEm.toISOString(), recebimentoExistente: proposta.recebimentoExistente ? { ...proposta.recebimentoExistente, dataPagamento: proposta.recebimentoExistente.dataPagamento.toISOString() } : null, aplicacao: proposta.aplicacao ? { ...proposta.aplicacao, aplicadaEm: proposta.aplicacao.aplicadaEm.toISOString() } : null })),
        ...paginas,
        temProxima: cobrancas.temProxima,
        temProximaRecebimentos: recebimentos.temProxima,
        temProximaPagadores: pagadores.temProxima,
        temProximaPropostas: propostas.temProxima,
        podeDecidir: true,
      };
    });
  });
}
/** Fila financeira própria: não concede acesso aos lotes administrativos completos. Paginada por número (E4), em ordem de id. */
export async function listarLinhasConciliacaoFinanceira(input: { pagina?: number } = {}) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.ADMINISTRADOR, Papel.FINANCEIRO);
    const { pagina = 1 } = z.object({ pagina: Pagina }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await usuarioFinanceiroFresco(tx, sessao.id);
      const linhas = await tx.linhaPreparacaoMigracao.findMany({
        where: { tipoEntrada: "FINANCEIRO_HISTORICO" },
        orderBy: { id: "asc" }, ...janelaDaPagina(pagina, porPagina),
        select: { id: true, linhaOrigem: true, matriculaOrigemId: true, financeiroOrigemId: true, estado: true, lote: { select: { origem: true, chaveLote: true } },
          propostasConciliacaoFinanceira: { orderBy: { versao: "desc" }, take: 1, select: { status: true, versao: true } } },
      });
      const { registros: itens, temProxima } = recorteDaPagina(linhas, porPagina);
      return { itens, pagina, temProxima };
    });
  });
}
