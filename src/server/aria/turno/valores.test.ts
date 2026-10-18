import { describe, expect, it } from "vitest";
import { valoresNaoAutorizados } from "./valores";

const vazio = { valores: [], percentuais: [], parcelas: [] };

describe("valoresNaoAutorizados", () => {
  it("formatos_variados_de_valor", () => {
    const p = { valores: [85000, 1200], percentuais: [10], parcelas: [10] };
    expect(valoresNaoAutorizados("A mensalidade é ₡85.000.", p)).toEqual([]);
    expect(valoresNaoAutorizados("Fica R$ 1.200,00 por mês", p)).toEqual([]);
    expect(valoresNaoAutorizados("sai por 1200 reais", p)).toEqual([]);
    expect(valoresNaoAutorizados("consigo 10 % de desconto em 10x", p)).toEqual([]);
    expect(valoresNaoAutorizados("faço por R$ 999", p)).toEqual(["R$ 999"]);
    expect(valoresNaoAutorizados("te dou dez por cento", { ...p, percentuais: [] })).toEqual(["dez por cento"]);
    expect(valoresNaoAutorizados("15% off", p)).toEqual(["15%"]);
  });

  it("horarios_e_datas_nao_sao_valor", () =>
    expect(valoresNaoAutorizados("Aula às 19h, dia 12/11, turma de 8 alunos", vazio)).toEqual([]));

  it("parcelas_e_siglas_de_moeda", () => {
    const p = { valores: [85000], percentuais: [], parcelas: [10] };
    expect(valoresNaoAutorizados("em 12x", p)).toEqual(["12x"]);
    expect(valoresNaoAutorizados("em 10 vezes", p)).toEqual([]);
    expect(valoresNaoAutorizados("CRC 85000 ou USD 50", p)).toEqual(["USD 50"]);
    expect(valoresNaoAutorizados("US$ 20 e 300 colones", p)).toEqual(["US$ 20", "300 colones"]);
  });

  it("percentual_por_extenso_composto_e_permitido", () => {
    expect(valoresNaoAutorizados("vinte e cinco por cento", { ...vazio, percentuais: [25] })).toEqual([]);
    expect(valoresNaoAutorizados("vinte e cinco por cento", vazio)).toEqual(["vinte e cinco por cento"]);
  });
});
