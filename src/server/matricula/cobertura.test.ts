import { describe, expect, it } from "vitest";
import { DataCivilSchema, efeitoPausaNaCobertura, periodoMensalNaData, RegraCoberturaSchema } from "./cobertura";
describe("cobertura contratual Q62/Q65", () => {
  it("calcula dias reais inclusive fevereiro bissexto", () => {
    expect(periodoMensalNaData({ referencia: "MES_CIVIL" }, "2024-02-15")).toEqual({ inicio: "2024-02-01", fim: "2024-02-29", dias: 29 });
    expect(periodoMensalNaData({ referencia: "MES_CIVIL" }, "2025-02-28").dias).toBe(28);
  });
  it("preserva aniversário 31 após fevereiro sem lacuna ou sobreposição", () => {
    const r = { referencia: "CICLO_MATRICULA", dataReferencia: "2026-01-31" } as const;
    expect(periodoMensalNaData(r, "2026-02-27")).toEqual({ inicio: "2026-01-31", fim: "2026-02-27", dias: 28 });
    expect(periodoMensalNaData(r, "2026-02-28")).toEqual({ inicio: "2026-02-28", fim: "2026-03-30", dias: 31 });
    expect(periodoMensalNaData(r, "2026-03-31").inicio).toBe("2026-03-31");
  });
  it("trata virada de ano e rejeita data anterior à referência", () => {
    const r = { referencia: "CICLO_MATRICULA", dataReferencia: "2025-12-15" } as const;
    expect(periodoMensalNaData(r, "2026-01-01")).toEqual({ inicio: "2025-12-15", fim: "2026-01-14", dias: 31 });
    expect(() => periodoMensalNaData(r, "2025-12-14")).toThrow();
  });
  it.each(["2026-02-30", "2026-13-01", "2026-1-1", "2026-01-01T10:00:00Z"])("rejeita data inválida %s", (s) => expect(DataCivilSchema.safeParse(s).success).toBe(false));
  it("exige configuração suficiente sem dados contraditórios", () => {
    expect(RegraCoberturaSchema.safeParse({ referencia: "CICLO_MATRICULA" }).success).toBe(false);
    expect(RegraCoberturaSchema.safeParse({ referencia: "MES_CIVIL", dataReferencia: "2026-01-01" }).success).toBe(false);
  });
  it("mantém período iniciado integral inclusive seus limites", () => {
    const p = { inicio: "2026-09-01", fim: "2026-09-30" };
    for (const data of [p.inicio, "2026-09-15", p.fim]) expect(efeitoPausaNaCobertura(p, data)).toBe("MANTER_PERIODO_INICIADO_INTEGRAL");
    expect(efeitoPausaNaCobertura(p, "2026-08-31")).toBe("SUSPENDER_PERIODO_FUTURO");
    expect(efeitoPausaNaCobertura(p, "2026-10-01")).toBe("PRESERVAR_PERIODO_ANTERIOR");
    expect(() => efeitoPausaNaCobertura({ inicio: p.fim, fim: p.inicio }, p.inicio)).toThrow();
  });
});
