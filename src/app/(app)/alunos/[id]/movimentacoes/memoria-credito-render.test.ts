import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemoriaCredito } from "./LiberacaoHoras";

const calculo = { moeda: "CRC", valorPagoOriginal: "200.00", descontoOriginal: "50.00", minutosComprados: 120, minutosConvertidos: 60, minutosAnteriores: 0, valorAnterior: "0.00", valorAcumulado: "100.00", valorCredito: "100.00" };

describe("memória de cálculo do crédito de horas (C2 da #261)", () => {
  it("compra com aditivo de adiantamento redutor rotula a diferença como redução, não desconto", () => {
    const html = renderToStaticMarkup(createElement(MemoriaCredito, { calculo, origemDiferenca: "REDUCAO_ADITIVO" }));
    expect(html).toContain("Redução do adiantamento por aditivo já considerada</dt><dd>50.00</dd>");
    expect(html).not.toContain("Desconto");
  });

  it("sem origem informada mantém o rótulo de desconto original", () => {
    const html = renderToStaticMarkup(createElement(MemoriaCredito, { calculo }));
    expect(html).toContain("Desconto original já considerado</dt><dd>50.00</dd>");
  });
});
