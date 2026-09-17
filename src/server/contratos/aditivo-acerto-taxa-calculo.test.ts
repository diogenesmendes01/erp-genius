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
    expect(() => calcularCreditoAcertoTaxa({ valorRecebido: "100", valorLiquidadoCredito: "0", valorNovo: "90", creditosTaxaJaOriginados: "20" })).toThrow(/conciliar o crédito/i);
  });
});
