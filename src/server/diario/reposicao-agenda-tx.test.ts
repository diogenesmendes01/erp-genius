import { describe, expect, it } from "vitest";
import { periodoBeneficioReposicao, vigenciaNovoBeneficioReposicao, type RegraBeneficio } from "./reposicao-agenda-tx";

const regra = (parcial: Partial<RegraBeneficio> = {}): RegraBeneficio => ({
  id: "regra", referencia: "CIVIL", unidade: "MESES", duracaoPeriodo: 1,
  quantidadePorPeriodo: 2, antecedenciaCancelamentoMinutos: 0, referenciaCiclo: null,
  vigenteAPartirDe: new Date("2026-01-01T00:00:00.000Z"), ...parcial,
});

describe("períodos e vigência de benefício de reposição", () => {
  it("mantém a âncora de ciclo no dia 31 após fevereiro", () => {
    const ciclo = regra({ referencia: "CICLO_MATRICULA", referenciaCiclo: new Date("2026-01-31T00:00:00.000Z") });
    expect(periodoBeneficioReposicao(ciclo, "2026-02-28")).toEqual({ inicio: "2026-02-28", fimExclusivo: "2026-03-31" });
  });

  it("dá a cota integral do período atual na primeira aplicação", () => {
    expect(vigenciaNovoBeneficioReposicao(null, regra({ vigenteAPartirDe: new Date("2026-02-15T00:00:00.000Z") }), "2026-02-15")).toBe("2026-02-01");
  });

  it("adianta regra alterada até o próximo limite dela sem reabrir período reservado", () => {
    const anterior = regra({ id: "anterior" });
    const trimestral = regra({ id: "trimestral", duracaoPeriodo: 3, vigenteAPartirDe: new Date("2026-02-01T00:00:00.000Z") });
    expect(vigenciaNovoBeneficioReposicao(anterior, trimestral, "2026-01-15")).toBe("2026-02-01");
    expect(periodoBeneficioReposicao(trimestral, "2026-02-02")).toEqual({ inicio: "2026-02-01", fimExclusivo: "2026-04-01" });
  });

  it("encadeia uma revisão depois do snapshot futuro já reservado", () => {
    const futuro = regra({ id: "futuro", vigenteAPartirDe: new Date("2026-04-01T00:00:00.000Z") });
    expect(vigenciaNovoBeneficioReposicao(futuro, regra({ id: "seguinte" }), "2026-04-01")).toBe("2026-05-01");
  });
});
