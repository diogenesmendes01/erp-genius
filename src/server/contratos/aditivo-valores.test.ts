import { describe, expect, it } from "vitest";
import { representarValorAlteracaoAditivo, validarValorAlteracaoAditivo } from "./aditivo-valores";

describe("validarValorAlteracaoAditivo", () => {
  it("aceita datas civis reais e decimal canônico preciso", () => {
    expect(validarValorAlteracaoAditivo("COBERTURA_FIM", { tipo: "DATA", data: "2028-02-29" })).toEqual({ tipo: "DATA", data: "2028-02-29" });
    expect(validarValorAlteracaoAditivo("MENSALIDADE_VALOR", { tipo: "DINHEIRO", valor: "1234567890.25", moeda: "BRL" })).toEqual({ tipo: "DINHEIRO", valor: "1234567890.25", moeda: "BRL" });
    expect(() => validarValorAlteracaoAditivo("COBERTURA_FIM", { tipo: "DATA", data: "2027-02-29" })).toThrow();
    expect(() => validarValorAlteracaoAditivo("MENSALIDADE_VALOR", { tipo: "DINHEIRO", valor: "01,20", moeda: "BRL" })).toThrow();
  });

  it("exige o tipo do campo e uma referência de agenda", () => {
    expect(() => validarValorAlteracaoAditivo("TAXA_VALOR", { tipo: "TEXT", texto: "100" })).toThrow(/DINHEIRO/);
    expect(validarValorAlteracaoAditivo("AGENDA_PARTICULAR", { tipo: "AGENDA", propostaAgendaId: "agenda-aprovada-1", texto: "Agenda aprovada" })).toEqual({ tipo: "AGENDA", propostaAgendaId: "agenda-aprovada-1", texto: "Agenda aprovada" });
    expect(() => validarValorAlteracaoAditivo("AGENDA_PARTICULAR", { tipo: "AGENDA", propostaAgendaId: "a", encontros: [] })).toThrow();
  });

  it("limita minutos e rejeita campos derivados", () => {
    expect(validarValorAlteracaoAditivo("ADIANTAMENTO_MINUTOS", { tipo: "MINUTOS", minutos: 5_256_000 })).toEqual({ tipo: "MINUTOS", minutos: 5_256_000 });
    expect(() => validarValorAlteracaoAditivo("ADIANTAMENTO_MINUTOS", { tipo: "MINUTOS", minutos: 5_256_001 })).toThrow();
    expect(() => validarValorAlteracaoAditivo("ADITIVO_VIGENCIA", { tipo: "DATA", data: "2026-01-01" })).toThrow(/derivados/);
  });

  it("representa valores estruturados sem conversão de locale", () => {
    expect(representarValorAlteracaoAditivo({ tipo: "DINHEIRO", valor: "12.5", moeda: "BRL" })).toBe("12.50 BRL");
    expect(representarValorAlteracaoAditivo({ tipo: "DINHEIRO", valor: "1234567890", moeda: "CRC" })).toBe("1234567890.00 CRC");
    expect(representarValorAlteracaoAditivo({ tipo: "DINHEIRO", valor: "0.01", moeda: "USD" })).toBe("0.01 USD");
    expect(representarValorAlteracaoAditivo({ tipo: "REGIME", regime: "HORA_PARTICULAR" })).toBe("Particular por hora");
    expect(representarValorAlteracaoAditivo({ tipo: "AGENDA", propostaAgendaId: "a1", texto: "Agenda aprovada" })).toBe("Agenda aprovada");
  });
});
