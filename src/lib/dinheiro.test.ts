import { describe, it, expect } from "vitest";
import { formatarMoeda, simboloMoeda, somarPorMoeda, formatarValores, consolidar, parseMoeda, formatarMoedaParaCampo, casasDecimais, avisoSemCentavos, formatarMoedaOuIndefinida, MOEDA_NAO_DEFINIDA } from "./dinheiro";

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

  it("valor inválido ou ausente vira \"—\", nunca um zero monetário falso", () => {
    expect(formatarMoeda(NaN, "USD")).toBe("—");
    expect(formatarMoeda("", "CRC")).toBe("—");
    expect(formatarMoeda("   ", "CRC")).toBe("—");
    expect(formatarMoeda("abc", "USD")).toBe("—");
    expect(formatarMoeda("1.250,00", "BRL")).toBe("—");
    expect(formatarMoeda(undefined as unknown as string, "USD")).toBe("—");
    expect(formatarMoeda(null as unknown as string, "USD")).toBe("—");
    expect(formatarMoeda(Infinity, "USD")).toBe("—");
    expect(formatarMoeda("0", "CRC")).toBe("₡ 0"); // zero de verdade continua zero
  });

  it("moeda sem centavos nunca esconde uma fração existente", () => {
    expect(formatarMoeda("1250.50", "CRC")).toBe("₡ 1.250,50");
    expect(formatarMoeda("0.40", "CRC")).toBe("₡ 0,40");
    expect(formatarMoeda(1.67, "CRC")).toBe("₡ 1,67");
    expect(formatarMoeda("1250.00", "CRC")).toBe("₡ 1.250");
    expect(formatarMoeda(1250, "CLP")).toMatch(/ 1\.250$/);
    expect(formatarMoeda(1250.5, "CLP")).toMatch(/ 1\.250,50$/);
  });
});

describe("dinheiro — parseMoeda (entrada do operador, ganho rápido 13 da auditoria)", () => {
  it("aceita vírgula decimal", () => {
    expect(parseMoeda("1234,56")).toBe(1234.56);
    expect(parseMoeda("0,5")).toBe(0.5);
  });

  it("aceita ponto decimal só quando ele não pode ser milhar pt-BR (4+ dígitos ou zero antes)", () => {
    expect(parseMoeda("1234.56")).toBe(1234.56);
    expect(parseMoeda("1234.5")).toBe(1234.5);
    expect(parseMoeda("0.5")).toBe(0.5);
    expect(parseMoeda("0.50")).toBe(0.5);
  });

  it("C5 (issue #167): REJEITA ponto ambíguo — 1 a 3 dígitos antes do ponto tem o formato do começo de um milhar", () => {
    expect(parseMoeda("1.23")).toBeNull(); // "1.230" com um dígito a menos, ou "123" com um ponto a mais
    expect(parseMoeda("1.2")).toBeNull();
    expect(parseMoeda("12.5")).toBeNull();
    expect(parseMoeda("100.50")).toBeNull();
    expect(parseMoeda(" 1.23 ")).toBeNull();
  });

  it("C5 (issue #167): a vírgula continua sem ambiguidade — 1,23 é 1,23", () => {
    expect(parseMoeda("1,23")).toBe(1.23);
    expect(parseMoeda("100,50")).toBe(100.5);
    expect(parseMoeda("12,5")).toBe(12.5);
  });

  it("aceita inteiro sem separador", () => {
    expect(parseMoeda("1234")).toBe(1234);
    expect(parseMoeda("0")).toBe(0);
  });

  it("REJEITA separador de milhar — o bug real que a auditoria encontrou: 1.234 não pode virar 1234, nem 1,234", () => {
    expect(parseMoeda("1.234")).toBeNull();
    expect(parseMoeda("1,234")).toBeNull();
    expect(parseMoeda("1.234,56")).toBeNull();
    expect(parseMoeda("1,234.56")).toBeNull();
  });

  it("rejeita mais de duas casas decimais", () => {
    expect(parseMoeda("12,345")).toBeNull();
    expect(parseMoeda("12.345")).toBeNull();
  });

  it("rejeita texto vazio, só espaço, ou não numérico", () => {
    expect(parseMoeda("")).toBeNull();
    expect(parseMoeda("   ")).toBeNull();
    expect(parseMoeda("abc")).toBeNull();
    expect(parseMoeda("R$ 100")).toBeNull();
  });

  it("rejeita negativo (dinheiro digitado não é negativo neste app)", () => {
    expect(parseMoeda("-100")).toBeNull();
  });

  it("tolera espaço nas pontas", () => {
    expect(parseMoeda("  1234,56  ")).toBe(1234.56);
  });

  it("aceita uma casa decimal só", () => {
    expect(parseMoeda("10,5")).toBe(10.5);
  });
});

describe("dinheiro — formatarMoedaParaCampo (normalização ao perder o foco)", () => {
  it("sem moeda informada, sempre duas casas, sempre vírgula, nunca separador de milhar", () => {
    expect(formatarMoedaParaCampo(1234.5)).toBe("1234,50");
    expect(formatarMoedaParaCampo(1234567.8)).toBe("1234567,80");
    expect(formatarMoedaParaCampo(0)).toBe("0,00");
  });

  it("com moeda de duas casas (USD/BRL/…), igual ao comportamento sem moeda", () => {
    expect(formatarMoedaParaCampo(1234.5, "USD")).toBe("1234,50");
    expect(formatarMoedaParaCampo(1234.5, "BRL")).toBe("1234,50");
  });

  it("com moeda sem centavos (CRC/CLP/…), sai sem casa decimal — mesma convenção de formatarMoeda", () => {
    expect(formatarMoedaParaCampo(2500000, "CRC")).toBe("2500000");
    expect(formatarMoedaParaCampo(0, "CRC")).toBe("0");
    expect(formatarMoedaParaCampo(100, "CRC")).toBe("100");
    expect(formatarMoedaParaCampo(100, "CLP")).toBe("100");
  });

  it("C6 (issue #167): moeda sem centavos com fração NUNCA é arredondada — sai com duas casas, como formatarMoeda", () => {
    expect(formatarMoedaParaCampo(100.5, "CRC")).toBe("100,50"); // antes: "101"
    expect(formatarMoedaParaCampo(100.5, "CLP")).toBe("100,50");
    expect(formatarMoedaParaCampo(1234.5, "CLP")).toBe("1234,50"); // antes: "1235"
    expect(formatarMoedaParaCampo(100.5, "BRL")).toBe("100,50");
    // O que sai, parseMoeda entende de volta, sem perder a fração.
    expect(parseMoeda(formatarMoedaParaCampo(100.5, "CRC"))).toBe(100.5);
  });

  it("o que formatarMoedaParaCampo devolve, parseMoeda entende de volta (round-trip), com e sem moeda", () => {
    for (const v of [0, 0.5, 10.5, 1234.56, 1234567.89]) {
      expect(parseMoeda(formatarMoedaParaCampo(v))).toBe(v);
      expect(parseMoeda(formatarMoedaParaCampo(v, "USD"))).toBe(v);
    }
    for (const v of [0, 100, 2500000]) {
      expect(parseMoeda(formatarMoedaParaCampo(v, "CRC"))).toBe(v);
    }
  });
});

describe("dinheiro — avisoSemCentavos (C6, issue #167)", () => {
  it("100,50 em CRC e CLP: avisa, citando a moeda, que não há centavos e que nada é arredondado", () => {
    expect(avisoSemCentavos("100,50", "CRC")).toBe("CRC não tem centavos — informe um valor inteiro. O valor digitado não é arredondado.");
    expect(avisoSemCentavos("100,50", "CLP")).toBe("CLP não tem centavos — informe um valor inteiro. O valor digitado não é arredondado.");
    expect(avisoSemCentavos("100,5", "crc")).toMatch(/^CRC não tem centavos/);
    expect(avisoSemCentavos("1234.5", "CRC")).toMatch(/^CRC não tem centavos/);
  });

  it("sem aviso: 100 em CRC, 100,00 em CRC (inteiro), 100,50 em BRL, sem moeda, texto vazio ou inválido", () => {
    expect(avisoSemCentavos("100", "CRC")).toBeNull();
    expect(avisoSemCentavos("100", "CLP")).toBeNull();
    expect(avisoSemCentavos("100,00", "CRC")).toBeNull();
    expect(avisoSemCentavos("100,50", "BRL")).toBeNull();
    expect(avisoSemCentavos("100,50", undefined)).toBeNull();
    expect(avisoSemCentavos("100,50", null)).toBeNull();
    expect(avisoSemCentavos("", "CRC")).toBeNull();
    expect(avisoSemCentavos("1.234,56", "CRC")).toBeNull(); // inválido é erro de quem valida, não aviso de centavos
  });
});

describe("dinheiro — formatarMoedaOuIndefinida (C20, issue #167)", () => {
  it("com moeda, igual a formatarMoeda", () => {
    expect(formatarMoedaOuIndefinida("100.00", "BRL")).toBe(formatarMoeda("100.00", "BRL"));
    expect(formatarMoedaOuIndefinida(1250, "CRC")).toBe(formatarMoeda(1250, "CRC"));
  });

  it("sem moeda (null, undefined, vazia): estado explícito, nunca o número solto", () => {
    expect(MOEDA_NAO_DEFINIDA).toBe("moeda não definida");
    for (const moeda of [null, undefined, "", "  "]) {
      expect(formatarMoedaOuIndefinida("100.00", moeda)).toBe(MOEDA_NAO_DEFINIDA);
    }
    expect(formatarMoedaOuIndefinida("100.00", null)).not.toMatch(/\d/);
  });
});

describe("dinheiro — casasDecimais", () => {
  it("0 para moedas sem centavos, 2 para as demais", () => {
    expect(casasDecimais("CRC")).toBe(0);
    expect(casasDecimais("CLP")).toBe(0);
    expect(casasDecimais("crc")).toBe(0); // normaliza caixa, igual simboloMoeda
    expect(casasDecimais("USD")).toBe(2);
    expect(casasDecimais("BRL")).toBe(2);
    expect(casasDecimais("XYZ")).toBe(2); // desconhecida cai no padrão de 2 casas
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
