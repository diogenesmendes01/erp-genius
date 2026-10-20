import { describe, expect, it } from "vitest";
import {
  DIA_PREVISAO_COMISSAO_MAX, DIA_PREVISAO_COMISSAO_MIN, DIA_PREVISAO_COMISSAO_PADRAO,
  DiaPrevisaoComissaoSchema, previsaoPagamentoComissao,
} from "./previsao-comissao";

// D11 (decisão do dono, 20/10/2026): a previsão de pagamento da comissão é o dia X do mês seguinte à competência,
// em data civil no fuso da escola. X é configurável (padrão 10, de 1 a 28).

describe("previsaoPagamentoComissao", () => {
  it("dia X do mês seguinte à competência", () => {
    expect(previsaoPagamentoComissao(new Date("2026-10-15T15:00:00Z"), "America/Sao_Paulo", 10)).toBe("2026-11-10");
    expect(previsaoPagamentoComissao(new Date("2026-02-28T15:00:00Z"), "America/Sao_Paulo", 28)).toBe("2026-03-28");
    expect(previsaoPagamentoComissao(new Date("2026-01-31T15:00:00Z"), "UTC", 1)).toBe("2026-02-01");
  });

  it("dezembro vira janeiro do ano seguinte", () => {
    expect(previsaoPagamentoComissao(new Date("2026-12-10T15:00:00Z"), "America/Sao_Paulo", 10)).toBe("2027-01-10");
    expect(previsaoPagamentoComissao(new Date("2026-12-31T12:00:00Z"), "America/Costa_Rica", 5)).toBe("2027-01-05");
  });

  it("a competência é o mês civil da escola, não o do servidor (UTC)", () => {
    // 01/11 às 01h UTC ainda é 31/10 em São Paulo: competência outubro, previsão em novembro.
    const instante = new Date("2026-11-01T01:00:00Z");
    expect(previsaoPagamentoComissao(instante, "America/Sao_Paulo", 10)).toBe("2026-11-10");
    expect(previsaoPagamentoComissao(instante, "UTC", 10)).toBe("2026-12-10");
    // 31/12 às 23h30 de São Paulo já é 1º/01 em UTC: a competência continua dezembro.
    expect(previsaoPagamentoComissao(new Date("2027-01-01T02:30:00Z"), "America/Sao_Paulo", 10)).toBe("2027-01-10");
  });

  it("o dia sai com dois dígitos", () => {
    expect(previsaoPagamentoComissao(new Date("2026-03-10T15:00:00Z"), "UTC", 7)).toBe("2026-04-07");
  });

  it("dia fora de 1 a 28 é recusado (fevereiro sempre tem o dia)", () => {
    expect(() => previsaoPagamentoComissao(new Date("2026-03-10T15:00:00Z"), "UTC", 29)).toThrow();
    expect(() => previsaoPagamentoComissao(new Date("2026-03-10T15:00:00Z"), "UTC", 0)).toThrow();
    expect(() => previsaoPagamentoComissao(new Date("2026-03-10T15:00:00Z"), "UTC", 10.5)).toThrow();
  });
});

describe("DiaPrevisaoComissaoSchema", () => {
  it("padrão 10, aceita de 1 a 28 inteiros", () => {
    expect(DIA_PREVISAO_COMISSAO_PADRAO).toBe(10);
    expect([DIA_PREVISAO_COMISSAO_MIN, DIA_PREVISAO_COMISSAO_MAX]).toEqual([1, 28]);
    expect(DiaPrevisaoComissaoSchema.safeParse(1).success).toBe(true);
    expect(DiaPrevisaoComissaoSchema.safeParse(28).success).toBe(true);
    for (const v of [0, 29, 10.5, "10", null]) expect(DiaPrevisaoComissaoSchema.safeParse(v).success).toBe(false);
  });
});
