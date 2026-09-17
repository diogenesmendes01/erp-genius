import { describe, expect, it } from "vitest";
import { calcularCreditoAcertoTaxa } from "./aditivo-acerto-taxa-calculo";

describe("calcularCreditoAcertoTaxa", () => {
  it("gera somente o incremento de crédito em duas reduções sucessivas", () => {
    const primeira = calcularCreditoAcertoTaxa({ valorRecebido: "100", valorLiquidadoCredito: "0", valorNovo: "80", creditosTaxaJaOriginados: "0" });
    expect(primeira.creditoNovo.toFixed(2)).toBe("20.00");
    const segunda = calcularCreditoAcertoTaxa({ valorRecebido: "100", valorLiquidadoCredito: "0", valorNovo: "70", creditosTaxaJaOriginados: primeira.creditoTotalDevido });
    expect(segunda.creditoNovo.toFixed(2)).toBe("10.00");
    expect(segunda.creditoTotalDevido.toFixed(2)).toBe("30.00");
  });

  it("não devolve crédito novamente quando redução anterior é seguida de aumento", () => {
    const resultado = calcularCreditoAcertoTaxa({ valorRecebido: "100", valorLiquidadoCredito: "0", valorNovo: "90", creditosTaxaJaOriginados: "20" });
    expect(resultado.creditoNovo.toFixed(2)).toBe("0.00");
    expect(resultado.pendencia).toMatchObject({ codigo: "CONCILIAR_CREDITO_EXISTENTE" });
    expect(resultado.pendencia?.valor.toFixed(2)).toBe("10.00");
  });

  it.each([
    ["dinheiro", "100", "0", "80", "20"],
    ["crédito", "0", "100", "80", "20"],
    ["misto", "50", "50", "80", "20"],
  ])("preserva o excedente quitado por %s", (_meio, valorRecebido, valorLiquidadoCredito, valorNovo, esperado) => {
    const resultado = calcularCreditoAcertoTaxa({ valorRecebido, valorLiquidadoCredito, valorNovo, creditosTaxaJaOriginados: "0" });
    expect(resultado.creditoNovo.toFixed(2)).toBe(`${esperado}.00`);
    expect(resultado.saldoAposAcerto.toFixed(2)).toBe("0.00");
  });

  it("não duplica o crédito em reduções sucessivas de uma taxa quitada por crédito", () => {
    const primeira = calcularCreditoAcertoTaxa({ valorRecebido: "0", valorLiquidadoCredito: "100", valorNovo: "80", creditosTaxaJaOriginados: "0" });
    const segunda = calcularCreditoAcertoTaxa({ valorRecebido: "0", valorLiquidadoCredito: "100", valorNovo: "70", creditosTaxaJaOriginados: primeira.creditoTotalDevido });
    expect(primeira.creditoNovo.toFixed(2)).toBe("20.00");
    expect(segunda.creditoNovo.toFixed(2)).toBe("10.00");
  });

  it("sinaliza a conciliação também se o crédito de taxa anterior veio de quitação por crédito", () => {
    const resultado = calcularCreditoAcertoTaxa({ valorRecebido: "0", valorLiquidadoCredito: "100", valorNovo: "90", creditosTaxaJaOriginados: "20" });
    expect(resultado.pendencia?.valor.toFixed(2)).toBe("10.00");
  });
});
