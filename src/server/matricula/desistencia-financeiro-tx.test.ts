import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { carregarFinanceiroDesistenciaTx } from "./desistencia-financeiro-tx";

describe("carregarFinanceiroDesistenciaTx", () => {
  it.each([false, true])("distingue crédito e serviço compensado sem expor valores no resumo: permuta=%s", async (comPermuta) => {
    const cobrancas = comPermuta ? [{
      id: "cobranca", versao: 2, tipo: "MENSALIDADE", status: "PENDENTE", moeda: "BRL",
      vencimento: new Date("2026-09-20T00:00:00Z"), coberturaInicio: null, coberturaFim: null,
      valorOriginal: new Prisma.Decimal(100), valorNegociado: new Prisma.Decimal(100),
      valorRecebido: null, valorLiquidadoCredito: new Prisma.Decimal(0),
      valorCompensadoPermuta: new Prisma.Decimal(40), saldo: new Prisma.Decimal(60), pagoEm: null,
      suspensaPorItemPausaId: null, canceladaPorPausaId: null, acertoMultaDecisaoId: null,
    }] : [];
    const cobrancaFindMany = vi.fn().mockResolvedValue(cobrancas);
    const creditoFindMany = vi.fn().mockResolvedValue([{
      id: "credito-da-matricula", origemLiberacaoId: null, origemAcertoId: "origem-acerto", origemPeriodoIntegralId: null,
      valorInicial: new Prisma.Decimal("37.50"), moeda: "BRL", criadoEm: new Date("2026-09-16T12:00:00.000Z"),
    }]);
    const vazio = vi.fn().mockResolvedValue([]);
    const tx = {
      $queryRaw: vi.fn(),
      cobranca: { findMany: cobrancaFindMany },
      creditoMatricula: { findMany: creditoFindMany },
      pagamentoInformado: { findMany: vazio },
      recebimento: { findMany: vazio },
      destinacaoRecebimento: { findMany: vazio },
      propostaUsoCredito: { findMany: vazio },
      compensacaoCoberturaMatricula: { findMany: vazio },
      itemEmissaoEntrada: { findMany: vazio },
      ajusteCobrancaAcerto: { findMany: vazio },
      emissaoFechamentoHoras: { findMany: vazio },
      emissaoCobrancasEntrada: { findMany: vazio },
      decisaoUsoCredito: { findMany: vazio },
      diaCompensacaoCobertura: { findMany: vazio },
    } as unknown as Prisma.TransactionClient;

    const resultado = await carregarFinanceiroDesistenciaTx(tx, "matricula-alvo");
    const snapshot = resultado.snapshot as unknown as { matriculaId: string; cobrancas: unknown[]; creditos: Array<Record<string, unknown>> };

    expect(cobrancaFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { matriculaId: "matricula-alvo" } }));
    expect(creditoFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { matriculaId: "matricula-alvo" } }));
    expect(snapshot).toMatchObject({
      matriculaId: "matricula-alvo", cobrancas: comPermuta ? [expect.objectContaining({ valorCompensadoPermuta: "40.00", valorRecebido: null, saldo: "60.00" })] : [],
      creditos: [{ id: "credito-da-matricula", origemAcertoId: "origem-acerto", valorInicial: "37.50", moeda: "BRL", criadoEm: "2026-09-16T12:00:00.000Z" }],
    });
    expect(resultado.resumo).toEqual({
      quantidadeCobrancas: comPermuta ? 1 : 0, quantidadeCreditos: 1, informesAConferir: 0, recebimentos: 0,
      cobrancasComLiquidacao: comPermuta ? 1 : 0, exigeConferenciaFinanceira: true, haAvancoFormal: comPermuta,
    });
    expect(resultado.resumo).not.toHaveProperty("valorInicial");
    expect(resultado.resumo).not.toHaveProperty("moeda");
  });
});
