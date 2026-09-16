import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { carregarFinanceiroDesistenciaTx } from "./desistencia-financeiro-tx";

describe("carregarFinanceiroDesistenciaTx", () => {
  it("sinaliza crédito isolado, fotografa origem e não expõe valores no resumo", async () => {
    const cobrancaFindMany = vi.fn().mockResolvedValue([]);
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
      matriculaId: "matricula-alvo", cobrancas: [],
      creditos: [{ id: "credito-da-matricula", origemAcertoId: "origem-acerto", valorInicial: "37.50", moeda: "BRL", criadoEm: "2026-09-16T12:00:00.000Z" }],
    });
    expect(resultado.resumo).toEqual({
      quantidadeCobrancas: 0, quantidadeCreditos: 1, informesAConferir: 0, recebimentos: 0,
      cobrancasComLiquidacao: 0, exigeConferenciaFinanceira: true, haAvancoFormal: false,
    });
    expect(resultado.resumo).not.toHaveProperty("valorInicial");
    expect(resultado.resumo).not.toHaveProperty("moeda");
  });
});
