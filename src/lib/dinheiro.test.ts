import { describe, it, expect } from "vitest";
import { formatarMoeda, simboloMoeda, somarPorMoeda, formatarValores, consolidar } from "./dinheiro";

describe("dinheiro — formatação por moeda", () => {
  it("usa símbolo e casas decimais corretos por moeda", () => {
    expect(formatarMoeda(3000, "USD")).toBe("US$ 3.000,00");
    expect(formatarMoeda(2500000, "CRC")).toBe("₡ 2.500.000"); // colón circula sem centavos
    expect(formatarMoeda(1234.5, "BRL")).toBe("R$ 1.234,50");
  });

  it("moeda desconhecida cai para o próprio código ISO (nunca quebra)", () => {
    expect(formatarMoeda(50, "PEN")).toBe("S/ 50,00");
    expect(formatarMoeda(50, "XYZ")).toBe("XYZ 50,00");
    expect(simboloMoeda("xyz")).toBe("XYZ");
    expect(simboloMoeda("crc")).toBe("₡");
  });

  it("semSimbolo devolve só o número formatado", () => {
    expect(formatarMoeda(3000, "USD", { semSimbolo: true })).toBe("3.000,00");
    expect(formatarMoeda(2500000, "CRC", { semSimbolo: true })).toBe("2.500.000");
  });

  it("valor inválido vira 0 (não NaN)", () => {
    expect(formatarMoeda(NaN, "USD")).toBe("US$ 0,00");
  });
});

describe("dinheiro — agregação por moeda", () => {
  it("agrupa por moeda e NUNCA mistura moedas diferentes", () => {
    const r = somarPorMoeda([
      { moeda: "CRC", valor: 2000000 },
      { moeda: "USD", valor: 3000 },
      { moeda: "CRC", valor: 500000 },
    ]);
    expect(r).toEqual([
      { moeda: "USD", valor: 3000 },
      { moeda: "CRC", valor: 2500000 },
    ]);
  });

  it("normaliza a moeda (caixa/espaços) ao agrupar", () => {
    const r = somarPorMoeda([
      { moeda: "usd", valor: 10 },
      { moeda: " USD ", valor: 5 },
    ]);
    expect(r).toEqual([{ moeda: "USD", valor: 15 }]);
  });

  it("lista vazia retorna lista vazia", () => {
    expect(somarPorMoeda([])).toEqual([]);
  });

  it("formatarValores junta as moedas inline; vazio vira travessão", () => {
    expect(
      formatarValores([
        { moeda: "CRC", valor: 2500000 },
        { moeda: "USD", valor: 3000 },
      ]),
    ).toBe("₡ 2.500.000 · US$ 3.000,00");
    expect(formatarValores([])).toBe("—");
  });
});

describe("dinheiro — consolidação multi-moeda (pivô USD, reporting-only)", () => {
  // 1 US$ = 512 CRC = 5.40 BRL
  const taxas = { CRC: 512, BRL: 5.4 };
  const valores = [
    { moeda: "CRC", valor: 2500000 },
    { moeda: "USD", valor: 3000 },
  ];

  it("consolida em USD (pivô): CRC→USD + USD", () => {
    const r = consolidar(valores, "USD", taxas);
    expect(Math.round(r.valor)).toBe(7883); // 2.500.000/512 + 3000
    expect(r.faltando).toEqual([]);
  });

  it("consolida em outra moeda via pivô (USD→alvo)", () => {
    // totalUsd = 2.500.000/512 + 3000 = 7882,8125
    const emCrc = consolidar(valores, "CRC", taxas);
    expect(Math.round(emCrc.valor)).toBe(4036000); // 7882,8125 * 512
    const emBrl = consolidar(valores, "BRL", taxas);
    expect(Math.round(emBrl.valor)).toBe(42567); // 7882,8125 * 5,40
  });

  it("moeda sem taxa é ignorada e reportada em faltando (total honesto)", () => {
    const r = consolidar([{ moeda: "CRC", valor: 512 }, { moeda: "MXN", valor: 100 }], "USD", taxas);
    expect(r.valor).toBe(1); // só o CRC entrou (512/512)
    expect(r.faltando).toEqual(["MXN"]);
  });

  it("sem taxa para a própria moeda-alvo → total 0 e alvo em faltando", () => {
    const r = consolidar(valores, "MXN", taxas);
    expect(r.valor).toBe(0);
    expect(r.faltando).toContain("MXN");
  });
});
