import { describe, expect, it } from "vitest";
import { valoresCitados, valoresNaoAutorizados } from "./valores";

const vazio = { valores: [], percentuais: [], parcelas: [] };

describe("valoresCitados", () => {
  it("extrai_valor_percentual_e_parcelas_com_a_mesma_leitura_da_guarda", () => {
    expect(valoresCitados("Matrícula R$ 350,00 em 12x, com 15% e mais vinte por cento. Aula às 19h.")).toEqual({
      valores: [350],
      percentuais: [15, 20],
      parcelas: [12],
    });
    expect(valoresCitados("Sem valores aqui, dia 12/11.")).toEqual(vazio);
  });

  it("o_texto_citado_passa_na_guarda_com_o_que_ele_mesmo_cita", () => {
    const t = "A mensalidade é ₡85.000 em 3 vezes, com 5% à vista.";
    expect(valoresNaoAutorizados(t, valoresCitados(t))).toEqual([]);
  });
});

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
