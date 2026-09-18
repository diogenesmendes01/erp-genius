import { Prisma } from "@prisma/client";

/**
 * Fonte financeira somente de leitura para a desistência da preparação (Q121).
 *
 * O chamador já deve ter travado calendário e matrícula. As cobranças são
 * travadas em ordem estável para que a proposta e a decisão possam comparar a
 * fotografia contra baixas, informes e usos de crédito concorrentes.
 *
 * Não inclui comprovantes, comentários, nomes ou outros dados sensíveis. Os
 * identificadores e as versões abaixo são fontes de revalidação futura.
 */
export async function carregarFinanceiroDesistenciaTx(
  tx: Prisma.TransactionClient,
  matriculaId: string,
): Promise<{
  snapshot: Prisma.InputJsonObject;
  resumo: {
    quantidadeCobrancas: number;
    quantidadeCreditos: number;
    informesAConferir: number;
    recebimentos: number;
    cobrancasComLiquidacao: number;
    exigeConferenciaFinanceira: boolean;
    haAvancoFormal: boolean;
  };
}> {
  const ids = await tx.cobranca.findMany({
    where: { matriculaId },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  for (const { id } of ids) {
    await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id = ${id} FOR SHARE`;
  }

  const cobrancas = await tx.cobranca.findMany({ where: { matriculaId }, orderBy: { id: "asc" } });
  const creditos = await tx.creditoMatricula.findMany({ where: { matriculaId }, orderBy: { id: "asc" }, select: {
    id: true, origemLiberacaoId: true, origemAcertoId: true, origemPeriodoIntegralId: true, origemDestinacaoRecebimentoId: true,
    valorInicial: true, moeda: true, criadoEm: true,
  } });
  const cobrancaIds = cobrancas.map((c) => c.id);
  const [informes, recebimentosRegistrados, usos, compensacoes, itensEmissao, ajustesAcerto, emissoesHoras] = await Promise.all([
    tx.pagamentoInformado.findMany({ where: { cobrancaId: { in: cobrancaIds } }, orderBy: { id: "asc" }, select: {
      id: true, cobrancaId: true, status: true, valor: true, moeda: true, dataPagamento: true, versao: true,
    } }),
    tx.destinacaoRecebimento.findMany({ where: { cobrancaId: { in: cobrancaIds } }, orderBy: { id: "asc" }, select: {
      id: true, cobrancaId: true, valor: true, recebimento: { select: { id: true, moeda: true, dataPagamento: true } },
    } }),
    tx.propostaUsoCredito.findMany({ where: { cobrancaId: { in: cobrancaIds } }, orderBy: { id: "asc" }, select: {
      id: true, cobrancaId: true, creditoId: true, valor: true, versao: true,
    } }),
    tx.compensacaoCoberturaMatricula.findMany({ where: { cobrancaOrigemId: { in: cobrancaIds } }, orderBy: { id: "asc" }, select: {
      id: true, cobrancaOrigemId: true, status: true, cobrancaVersao: true, decididaEm: true,
    } }),
    tx.itemEmissaoEntrada.findMany({ where: { cobrancaId: { in: cobrancaIds } }, orderBy: { id: "asc" }, select: {
      id: true, cobrancaId: true, emissaoId: true,
    } }),
    tx.ajusteCobrancaAcerto.findMany({ where: { cobrancaId: { in: cobrancaIds } }, orderBy: { id: "asc" }, select: {
      id: true, cobrancaId: true, decisaoId: true, valorNovo: true, criadoEm: true,
    } }),
    tx.emissaoFechamentoHoras.findMany({ where: { cobrancaId: { in: cobrancaIds } }, orderBy: { id: "asc" }, select: {
      id: true, cobrancaId: true, decisaoId: true, criadaEm: true,
    } }),
  ]);
  const emissaoIds = itensEmissao.map((i) => i.emissaoId);
  const emissoesEntrada = await tx.emissaoCobrancasEntrada.findMany({ where: { id: { in: emissaoIds } }, select: {
    id: true, etapa: true, condicoesId: true, criadaEm: true,
  } });
  const usoIds = usos.map((u) => u.id);
  const decisoesUso = await tx.decisaoUsoCredito.findMany({ where: { propostaId: { in: usoIds } }, select: {
    id: true, propostaId: true, aprovada: true, decididaEm: true,
  } });
  const dias = await tx.diaCompensacaoCobertura.findMany({ where: { compensacaoId: { in: compensacoes.map((p) => p.id) } }, orderBy: { id: "asc" }, select: {
    id: true, compensacaoId: true, estado: true, versao: true,
  } });

  const serializadas = cobrancas.map((c) => ({
    id: c.id,
    versao: c.versao,
    tipo: c.tipo,
    status: c.status,
    moeda: c.moeda,
    vencimento: c.vencimento.toISOString(),
    coberturaInicio: c.coberturaInicio?.toISOString().slice(0, 10) ?? null,
    coberturaFim: c.coberturaFim?.toISOString().slice(0, 10) ?? null,
    valorOriginal: c.valorOriginal.toFixed(2),
    valorNegociado: c.valorNegociado.toFixed(2),
    valorRecebido: c.valorRecebido?.toFixed(2) ?? null,
    valorLiquidadoCredito: c.valorLiquidadoCredito.toFixed(2),
    ...(c.valorCompensadoPermuta.gt(0) ? { valorCompensadoPermuta: c.valorCompensadoPermuta.toFixed(2) } : {}),
    saldo: c.saldo?.toFixed(2) ?? null,
    pagoEm: c.pagoEm?.toISOString() ?? null,
    fontes: {
      emissaoEntrada: (() => {
        const item = itensEmissao.find((i) => i.cobrancaId === c.id);
        const emissao = item && emissoesEntrada.find((e) => e.id === item.emissaoId);
        return item && emissao ? { itemId: item.id, emissaoId: item.emissaoId, etapa: emissao.etapa,
          condicoesId: emissao.condicoesId, criadaEm: emissao.criadaEm.toISOString() } : null;
      })(),
      suspensaPorItemPausaId: c.suspensaPorItemPausaId,
      canceladaPorPausaId: c.canceladaPorPausaId,
      ajusteAcerto: (() => {
        const ajuste = ajustesAcerto.find((a) => a.cobrancaId === c.id);
        return ajuste ? { id: ajuste.id, decisaoId: ajuste.decisaoId, valorNovo: ajuste.valorNovo.toFixed(2),
          criadoEm: ajuste.criadoEm.toISOString() } : null;
      })(),
      emissaoFechamentoHoras: (() => {
        const emissao = emissoesHoras.find((e) => e.cobrancaId === c.id);
        return emissao ? { id: emissao.id, decisaoId: emissao.decisaoId, criadaEm: emissao.criadaEm.toISOString() } : null;
      })(),
      acertoMultaDecisaoId: c.acertoMultaDecisaoId,
    },
    informes: informes.filter((i) => i.cobrancaId === c.id).map((i) => ({
      id: i.id, status: i.status, versao: i.versao, valor: i.valor.toFixed(2),
      moeda: i.moeda, dataPagamento: i.dataPagamento.toISOString(),
    })),
    recebimentos: recebimentosRegistrados.filter((r) => r.cobrancaId === c.id).map((r) => ({
      id: r.id, recebimentoId: r.recebimento.id, valor: r.valor.toFixed(2), moeda: r.recebimento.moeda, dataPagamento: r.recebimento.dataPagamento.toISOString(),
    })),
    utilizacoesCredito: usos.filter((u) => u.cobrancaId === c.id).map((u) => ({
      id: u.id, creditoId: u.creditoId, versao: u.versao, valor: u.valor.toFixed(2),
      decisao: (() => { const decisao = decisoesUso.find((d) => d.propostaId === u.id); return decisao ? {
        id: decisao.id, aprovada: decisao.aprovada, decididaEm: decisao.decididaEm.toISOString(),
      } : null; })(),
    })),
    compensacoes: compensacoes.filter((p) => p.cobrancaOrigemId === c.id).map((p) => ({
      id: p.id, status: p.status, cobrancaVersao: p.cobrancaVersao,
      decididaEm: p.decididaEm?.toISOString() ?? null,
      dias: dias.filter((d) => d.compensacaoId === p.id).map((d) => ({ id: d.id, estado: d.estado, versao: d.versao })),
    })),
  }));

  const informesAConferir = informes.filter((i) => i.status === "A_CONFERIR").length;
  const recebimentos = recebimentosRegistrados.length;
  const cobrancasComLiquidacao = cobrancas.filter((c) => (c.valorLiquidadoCredito.gt(0) || c.valorCompensadoPermuta.gt(0))).length;
  const haAvancoFormal = cobrancas.some((c) =>
    informes.some((i) => i.cobrancaId === c.id && (i.status === "A_CONFERIR" || i.status === "CONFIRMADO")) ||
    recebimentosRegistrados.some((r) => r.cobrancaId === c.id) || c.status === "PAGO" || c.pagoEm !== null ||
    (c.valorRecebido?.gt(0) ?? false) || (c.valorLiquidadoCredito.gt(0) || c.valorCompensadoPermuta.gt(0)),
  );

  return {
    snapshot: { matriculaId, cobrancas: serializadas, creditos: creditos.map(c => ({
      ...c, valorInicial: c.valorInicial.toFixed(2), criadoEm: c.criadoEm.toISOString(),
    })) },
    resumo: {
      quantidadeCobrancas: cobrancas.length,
      quantidadeCreditos: creditos.length,
      informesAConferir,
      recebimentos,
      cobrancasComLiquidacao,
      // A mera emissão/cadastro de cobrança também requer conferência; ela não
      // equivale a pagamento nem é apagada da fotografia por não ter emissão.
      exigeConferenciaFinanceira: cobrancas.length > 0 || creditos.length > 0,
      haAvancoFormal,
    },
  };
}
