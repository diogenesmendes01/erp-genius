import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemoriaCredito } from "./LiberacaoHoras";

const calculo = (descontoOriginal: string) => ({ moeda: "CRC", valorPagoOriginal: "200.00", descontoOriginal, minutosComprados: 120, minutosConvertidos: 60, minutosAnteriores: 0, valorAnterior: "0.00", valorAcumulado: "100.00", valorCredito: "100.00" });
const render = (descontoOriginal: string, desconto: string, reducaoAditivo: string) =>
  renderToStaticMarkup(createElement(MemoriaCredito, { calculo: calculo(descontoOriginal), diferencaCompra: { desconto, reducaoAditivo } }));

describe("memória de cálculo do crédito de horas (B1 da #264)", () => {
  it("desconto de emissão e redução por aditivo aparecem como parcelas separadas", () => {
    const html = render("100.00", "50.00", "50.00");
    expect(html).toContain("Desconto original já considerado</dt><dd>50.00</dd>");
    expect(html).toContain("Redução do adiantamento por aditivo já considerada</dt><dd>50.00</dd>");
  });

  it("só redução por aditivo não mostra desconto", () => {
    const html = render("50.00", "0.00", "50.00");
    expect(html).toContain("Redução do adiantamento por aditivo já considerada</dt><dd>50.00</dd>");
    expect(html).not.toContain("Desconto");
  });

  it("sem redução por aditivo mantém o desconto original gravado no cálculo", () => {
    const html = render("50.00", "50.00", "0.00");
    expect(html).toContain("Desconto original já considerado</dt><dd>50.00</dd>");
    expect(html).not.toContain("Redução");
    expect(render("0.00", "0.00", "0.00")).toContain("Desconto original já considerado</dt><dd>0.00</dd>");
  });
});
