import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import type { OrigemLiquidacaoAcerto } from "./excedente-permuta-calculo";

export type PendenciaCreditoAnterior = {
  codigo: "CREDITO_ANTERIOR_SEM_ATRIBUICAO_POR_ORIGEM";
  origem: "TAXA_ADITIVO" | "ENCERRAMENTO_LEGADO" | "PERIODO_SEM_OFERTA" | "DESISTENCIA_CONTRATUAL";
  ids: string[];
  valor: string;
};

export type PendenciaOrigem = PendenciaCreditoAnterior | {
  codigo: "INFORME_PAGAMENTO_A_CONFERIR" | "PROPOSTA_USO_CREDITO_A_DECIDIR";
  ids: string[];
};

/**
 * Fotografia somente de leitura das liquidações já aplicadas a uma cobrança.
 *
 * `obrigacaoAtual` é contexto para uma proposta futura; deliberadamente não é
 * passada como `valorDevido` ao calculador. Quem propuser a nova destinação
 * precisa informar a obrigação que foi acordada e revalidar esta versão.
 */
export async function carregarOrigensExcedentePermutaTx(
  tx: Prisma.TransactionClient,
  entrada: { matriculaId: string; cobrancaId: string },
): Promise<{
  status: "PRONTA" | "PENDENTE_ORIGEM_NAO_FINAL";
  fotografia: {
    matriculaId: string; cobrancaId: string; versaoCobranca: number; moeda: string;
    obrigacaoAtual: string; recebido: string; creditoLiquidado: string; permutaCompensada: string; saldo: string | null;
    informesAConferir: Array<{ id: string; versao: number; valor: string; moeda: string }>;
    propostasUsoCreditoAguardarDecisao: Array<{ id: string; creditoId: string; versao: number; valor: string }>;
    cadeias: Array<{ origemId: string; tipo: "CAIXA" | "CREDITO" | "PERMUTA"; recebimentoId?: string; destinacaoId?: string; creditoId?: string; propostaId?: string; decisaoId?: string; aplicacaoId?: string; confirmacaoId?: string; acordoId?: string; saldoServicoId?: string }>;
  };
  origens: OrigemLiquidacaoAcerto[];
  pendencias: PendenciaOrigem[];
}> {
  if (!entrada.matriculaId || !entrada.cobrancaId) throw new ErroRegra("Matrícula e cobrança são obrigatórias.");
  const cobranca = await tx.cobranca.findFirst({ where: { id: entrada.cobrancaId, matriculaId: entrada.matriculaId }, select: {
    id: true, matriculaId: true, versao: true, moeda: true, valorNegociado: true, valorRecebido: true, valorLiquidadoCredito: true, valorCompensadoPermuta: true, saldo: true,
    matricula: { select: { moeda: true } },
    informes: { where: { status: "A_CONFERIR" }, orderBy: { id: "asc" }, select: { id: true, versao: true, valor: true, moeda: true } },
    destinacoesRecebimento: { orderBy: { id: "asc" }, select: { id: true, cobrancaId: true, valor: true, recebimento: { select: { id: true, titularMatriculaId: true, moeda: true } } } },
    utilizacoesCreditoPropostas: { orderBy: { id: "asc" }, select: { id: true, cobrancaId: true, versao: true, valor: true, decisao: { select: { id: true, aprovada: true } }, credito: { select: { id: true, matriculaId: true, moeda: true } } } },
    aplicacoesPermuta: { orderBy: { id: "asc" }, select: {
      id: true, cobrancaId: true, valor: true, decisaoId: true,
      decisao: { select: { id: true, aprovada: true, propostaId: true } },
      usoSaldoServico: { select: { id: true, aprovada: true, proposta: { select: { id: true, cobrancaId: true, valor: true, moeda: true, saldo: { select: { id: true, matriculaId: true, moeda: true } } } } } },
      destino: { select: {
        id: true, cobrancaId: true, valor: true, propostaId: true,
        proposta: { select: {
          id: true, decisao: { select: { id: true, aprovada: true } },
          confirmacao: { select: { id: true, acordo: { select: { id: true, matriculaId: true, moeda: true } } } },
        } },
      } },
    } },
    ajusteAcerto: { select: { id: true, versaoAnterior: true, valorAnterior: true, valorNovo: true, creditoApurado: true, moeda: true, origem: true } },
    origensCreditoAcertoTaxaAditivo: { orderBy: { id: "asc" }, select: { id: true, matriculaId: true, cobrancaId: true, valor: true, moeda: true } },
    aplicacoesPeriodoIntegral: { orderBy: { id: "asc" }, select: { id: true, matriculaId: true, cobrancaId: true, credito: { select: { id: true, valorInicial: true, moeda: true } } } },
  } });
  if (!cobranca) throw new ErroRegra("Cobrança não encontrada para a matrícula.");
  if (cobranca.matricula.moeda !== cobranca.moeda) throw new ErroRegra("A moeda da matrícula diverge da cobrança.");

  const zero = new Prisma.Decimal(0);
  const somar = (valores: Prisma.Decimal[]) => valores.reduce((total, valor) => total.plus(valor), zero);
  const positivo = (valor: Prisma.Decimal, mensagem: string) => {
    if (valor.lte(0)) throw new ErroRegra(mensagem);
  };
  const origens: OrigemLiquidacaoAcerto[] = [];
  const cadeias: Array<{ origemId: string; tipo: "CAIXA" | "CREDITO" | "PERMUTA"; recebimentoId?: string; destinacaoId?: string; creditoId?: string; propostaId?: string; decisaoId?: string; aplicacaoId?: string; confirmacaoId?: string; acordoId?: string; saldoServicoId?: string }> = [];

  for (const destino of cobranca.destinacoesRecebimento) {
    if (destino.cobrancaId !== cobranca.id || destino.recebimento.titularMatriculaId !== cobranca.matriculaId || destino.recebimento.moeda !== cobranca.moeda) {
      throw new ErroRegra("A destinação de caixa não preserva cobrança, matrícula ou moeda.");
    }
    positivo(destino.valor, "A destinação de caixa deve ter valor positivo.");
    origens.push({ id: destino.id, tipo: "CAIXA", cobrancaId: cobranca.id, versaoCobranca: cobranca.versao, moeda: cobranca.moeda, valor: destino.valor });
    cadeias.push({ origemId: destino.id, tipo: "CAIXA", recebimentoId: destino.recebimento.id, destinacaoId: destino.id });
  }
  const totalCaixa = somar(cobranca.destinacoesRecebimento.map((d) => d.valor));
  if (!totalCaixa.equals(cobranca.valorRecebido ?? zero)) throw new ErroRegra("O contador de caixa diverge das destinações identificadas.");

  for (const uso of cobranca.utilizacoesCreditoPropostas) {
    if (uso.cobrancaId !== cobranca.id || uso.credito.matriculaId !== cobranca.matriculaId || uso.credito.moeda !== cobranca.moeda) {
      throw new ErroRegra("A utilização de crédito não preserva cobrança, matrícula ou moeda.");
    }
    positivo(uso.valor, "A utilização de crédito deve ter valor positivo.");
  }
  // Não há aplicação separada no modelo: a decisão aprovada dispara o trigger
  // na mesma transação. Assim, decisão aprovada + contador reconciliado é final.
  const usosAprovados = cobranca.utilizacoesCreditoPropostas.filter((uso) => uso.decisao?.aprovada);
  for (const uso of usosAprovados) {
    origens.push({ id: uso.id, tipo: "CREDITO", cobrancaId: cobranca.id, versaoCobranca: cobranca.versao, moeda: cobranca.moeda, valor: uso.valor });
    cadeias.push({ origemId: uso.id, tipo: "CREDITO", creditoId: uso.credito.id, propostaId: uso.id, decisaoId: uso.decisao!.id });
  }
  const totalCredito = somar(usosAprovados.map((uso) => uso.valor));
  if (!totalCredito.equals(cobranca.valorLiquidadoCredito)) throw new ErroRegra("O contador de crédito diverge das utilizações aprovadas.");

  for (const aplicacao of cobranca.aplicacoesPermuta) {
    // Q171: uso aprovado do saldo restrito a serviços também é liquidação por serviço (fonte PERMUTA), com cadeia própria.
    if (aplicacao.usoSaldoServico) {
      const uso = aplicacao.usoSaldoServico, saldo = uso.proposta.saldo;
      if (aplicacao.destino || aplicacao.decisao || aplicacao.cobrancaId !== cobranca.id || uso.proposta.cobrancaId !== cobranca.id || !uso.aprovada ||
        saldo.matriculaId !== cobranca.matriculaId || saldo.moeda !== cobranca.moeda || uso.proposta.moeda !== cobranca.moeda || !aplicacao.valor.equals(uso.proposta.valor)) {
        throw new ErroRegra("A aplicação do saldo de serviços não preserva a cadeia aprovada de saldo, proposta e decisão.");
      }
      positivo(aplicacao.valor, "A aplicação de permuta deve ter valor positivo.");
      origens.push({ id: aplicacao.id, tipo: "PERMUTA", cobrancaId: cobranca.id, versaoCobranca: cobranca.versao, moeda: cobranca.moeda, valor: aplicacao.valor });
      cadeias.push({ origemId: aplicacao.id, tipo: "PERMUTA", aplicacaoId: aplicacao.id, decisaoId: uso.id, propostaId: uso.proposta.id, saldoServicoId: saldo.id });
      continue;
    }
    if (!aplicacao.destino || !aplicacao.decisao) throw new ErroRegra("A aplicação de permuta não possui destino aprovado nem uso de saldo de serviços.");
    const proposta = aplicacao.destino.proposta;
    const acordo = proposta.confirmacao.acordo;
    if (aplicacao.cobrancaId !== cobranca.id || aplicacao.destino.cobrancaId !== cobranca.id ||
      !aplicacao.decisao.aprovada || proposta.decisao?.id !== aplicacao.decisaoId || !proposta.decisao.aprovada ||
      aplicacao.decisao.propostaId !== proposta.id || acordo.matriculaId !== cobranca.matriculaId || acordo.moeda !== cobranca.moeda ||
      !aplicacao.valor.equals(aplicacao.destino.valor)) {
      throw new ErroRegra("A aplicação de permuta não preserva a cadeia aprovada de acordo, confirmação, proposta e destino.");
    }
    positivo(aplicacao.valor, "A aplicação de permuta deve ter valor positivo.");
    origens.push({ id: aplicacao.id, tipo: "PERMUTA", cobrancaId: cobranca.id, versaoCobranca: cobranca.versao, moeda: cobranca.moeda, valor: aplicacao.valor });
    cadeias.push({ origemId: aplicacao.id, tipo: "PERMUTA", aplicacaoId: aplicacao.id, decisaoId: aplicacao.decisaoId, propostaId: proposta.id, confirmacaoId: proposta.confirmacao.id, acordoId: acordo.id, destinacaoId: aplicacao.destino.id });
  }
  const totalPermuta = somar(cobranca.aplicacoesPermuta.map((aplicacao) => aplicacao.valor));
  if (!totalPermuta.equals(cobranca.valorCompensadoPermuta)) throw new ErroRegra("O contador de permuta diverge das aplicações aprovadas.");

  const pendencias: PendenciaOrigem[] = [];
  for (const informe of cobranca.informes) {
    if (informe.moeda !== cobranca.moeda || informe.valor.lte(0)) throw new ErroRegra("O informe pendente diverge da moeda ou do valor da cobrança.");
  }
  if (cobranca.informes.length) pendencias.push({ codigo: "INFORME_PAGAMENTO_A_CONFERIR", ids: cobranca.informes.map((informe) => informe.id) });
  const usosPendentes = cobranca.utilizacoesCreditoPropostas.filter((uso) => !uso.decisao);
  if (usosPendentes.length) pendencias.push({ codigo: "PROPOSTA_USO_CREDITO_A_DECIDIR", ids: usosPendentes.map((uso) => uso.id) });
  const creditosAcerto = await tx.origemCreditoAcerto.findMany({ where: {
    matriculaId: cobranca.matriculaId, origemTipo: "COBRANCA", origemId: cobranca.id,
  }, orderBy: { id: "asc" }, select: { id: true, decisaoId: true, matriculaId: true, origemTipo: true, origemId: true, valor: true, moeda: true } });
  for (const credito of creditosAcerto) {
    if (credito.matriculaId !== cobranca.matriculaId || credito.origemTipo !== "COBRANCA" || credito.origemId !== cobranca.id || credito.moeda !== cobranca.moeda || credito.valor.lte(0)) {
      throw new ErroRegra("O crédito de acerto anterior diverge da cobrança.");
    }
  }
  const ajuste = cobranca.ajusteAcerto;
  if (ajuste) {
    const origem = ajuste.origem;
    const fotografiaValida = !!origem && typeof origem === "object" && !Array.isArray(origem) &&
      (origem as Record<string, unknown>).id === cobranca.id && (origem as Record<string, unknown>).matriculaId === cobranca.matriculaId &&
      (origem as Record<string, unknown>).versao === ajuste.versaoAnterior && (origem as Record<string, unknown>).moeda === cobranca.moeda;
    if (!fotografiaValida || ajuste.moeda !== cobranca.moeda || ajuste.versaoAnterior >= cobranca.versao || !ajuste.valorNovo.equals(cobranca.valorNegociado)) {
      throw new ErroRegra("O ajuste anterior não possui evidência estruturada compatível com o estado atual da cobrança.");
    }
    const totalCreditoAcerto = somar(creditosAcerto.map((credito) => credito.valor));
    if (!totalCreditoAcerto.equals(ajuste.creditoApurado)) throw new ErroRegra("O crédito do ajuste anterior não corresponde às origens estruturadas.");
  }
  const totalCreditoAcerto = somar(creditosAcerto.map((credito) => credito.valor));
  if (totalCreditoAcerto.gt(0)) pendencias.push({ codigo: "CREDITO_ANTERIOR_SEM_ATRIBUICAO_POR_ORIGEM", origem: "ENCERRAMENTO_LEGADO", ids: [...(ajuste ? [ajuste.id] : []), ...creditosAcerto.map((credito) => credito.id)], valor: totalCreditoAcerto.toFixed(2) });
  for (const origem of cobranca.origensCreditoAcertoTaxaAditivo) {
    if (origem.matriculaId !== cobranca.matriculaId || origem.cobrancaId !== cobranca.id || origem.moeda !== cobranca.moeda || origem.valor.lte(0)) throw new ErroRegra("O crédito de taxa anterior diverge da cobrança.");
  }
  const totalTaxa = somar(cobranca.origensCreditoAcertoTaxaAditivo.map((origem) => origem.valor));
  if (totalTaxa.gt(0)) pendencias.push({ codigo: "CREDITO_ANTERIOR_SEM_ATRIBUICAO_POR_ORIGEM", origem: "TAXA_ADITIVO", ids: cobranca.origensCreditoAcertoTaxaAditivo.map((origem) => origem.id), valor: totalTaxa.toFixed(2) });
  for (const aplicacao of cobranca.aplicacoesPeriodoIntegral) {
    if (aplicacao.matriculaId !== cobranca.matriculaId || aplicacao.cobrancaId !== cobranca.id || (aplicacao.credito && aplicacao.credito.moeda !== cobranca.moeda)) throw new ErroRegra("A aplicação de período sem oferta diverge da cobrança.");
    if (aplicacao.credito && aplicacao.credito.valorInicial.gt(0)) pendencias.push({ codigo: "CREDITO_ANTERIOR_SEM_ATRIBUICAO_POR_ORIGEM", origem: "PERIODO_SEM_OFERTA", ids: [aplicacao.id, aplicacao.credito.id], valor: aplicacao.credito.valorInicial.toFixed(2) });
  }

  const origensDesistencia = await tx.origemCreditoAcertoDesistenciaContratual.findMany({
    where: { matriculaId: cobranca.matriculaId, cobrancaId: cobranca.id }, orderBy: { id: "asc" },
    select: { id: true, matriculaId: true, cobrancaId: true, valor: true, moeda: true,
      credito: { select: { id: true, matriculaId: true, valorInicial: true, moeda: true } },
    },
  });
  for (const origem of origensDesistencia) {
    if (origem.matriculaId !== cobranca.matriculaId || origem.cobrancaId !== cobranca.id || origem.moeda !== cobranca.moeda
      || origem.valor.lte(0) || !origem.credito || origem.credito.matriculaId !== cobranca.matriculaId
      || origem.credito.moeda !== origem.moeda || !origem.credito.valorInicial.equals(origem.valor)) {
      throw new ErroRegra("O crédito de desistência anterior não corresponde à origem comprovada.");
    }
    pendencias.push({ codigo: "CREDITO_ANTERIOR_SEM_ATRIBUICAO_POR_ORIGEM", origem: "DESISTENCIA_CONTRATUAL",
      ids: [origem.id, origem.credito.id], valor: origem.valor.toFixed(2) });
  }

  return {
    status: pendencias.length ? "PENDENTE_ORIGEM_NAO_FINAL" : "PRONTA",
    fotografia: { matriculaId: cobranca.matriculaId, cobrancaId: cobranca.id, versaoCobranca: cobranca.versao, moeda: cobranca.moeda,
      obrigacaoAtual: cobranca.valorNegociado.toFixed(2), recebido: (cobranca.valorRecebido ?? zero).toFixed(2), creditoLiquidado: cobranca.valorLiquidadoCredito.toFixed(2), permutaCompensada: cobranca.valorCompensadoPermuta.toFixed(2), saldo: cobranca.saldo?.toFixed(2) ?? null,
      informesAConferir: cobranca.informes.map((informe) => ({ id: informe.id, versao: informe.versao, valor: informe.valor.toFixed(2), moeda: informe.moeda })),
      propostasUsoCreditoAguardarDecisao: usosPendentes.map((uso) => ({ id: uso.id, creditoId: uso.credito.id, versao: uso.versao, valor: uso.valor.toFixed(2) })), cadeias },
    origens,
    pendencias,
  };
}
