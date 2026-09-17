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

  it("preserva o crédito emitido e projeta saldo líquido quando a taxa aumenta", () => {
    const resultado = calcularCreditoAcertoTaxa({ valorRecebido: "100", valorLiquidadoCredito: "0", valorNovo: "90", creditosTaxaJaOriginados: "20" });
    expect(resultado.creditoNovo.toFixed(2)).toBe("0.00");
    expect(resultado.pendencia).toBeNull();
    expect(resultado.saldoAposAcerto.toFixed(2)).toBe("10.00");
  });
  it.each([["90", "10.00"], ["120", "40.00"]])("mantém crédito 20 e saldo econômico %s para taxa %s", (valorNovo, saldo) => {
    const resultado = calcularCreditoAcertoTaxa({ valorRecebido: "100", valorLiquidadoCredito: "0", valorNovo, creditosTaxaJaOriginados: "20" });
    expect(resultado.creditoNovo.toFixed(2)).toBe("0.00");
    expect(resultado.saldoAposAcerto.toFixed(2)).toBe(saldo);
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

  it("projeta a mesma liquidação líquida para crédito emitido após quitação por crédito", () => {
    const resultado = calcularCreditoAcertoTaxa({ valorRecebido: "0", valorLiquidadoCredito: "100", valorNovo: "90", creditosTaxaJaOriginados: "20" });
    expect(resultado.saldoAposAcerto.toFixed(2)).toBe("10.00");
  });
});
