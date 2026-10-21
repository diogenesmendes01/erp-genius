import { expect, it } from "vitest";
import { periodoBeneficioReposicao, type RegraBeneficio } from "./reposicao-agenda-tx";

const regra: RegraBeneficio = { id: "regra", referencia: "CICLO_MATRICULA", unidade: "MESES", duracaoPeriodo: 1,
  quantidadePorPeriodo: 3, antecedenciaCancelamentoMinutos: 60,
  referenciaCiclo: new Date("2026-01-31T00:00:00Z"), vigenteAPartirDe: new Date("2026-01-31T00:00:00Z") };

it.each([
  ["2026-02-27", "2026-01-31", "2026-02-28"],
  ["2026-02-28", "2026-02-28", "2026-03-31"],
  ["2026-03-30", "2026-02-28", "2026-03-31"],
  ["2026-03-31", "2026-03-31", "2026-04-30"],
  ["2026-04-30", "2026-04-30", "2026-05-31"],
])("preserva âncora dia 31 ao calcular %s", (data, inicio, fimExclusivo) => {
  expect(periodoBeneficioReposicao(regra, data)).toEqual({ inicio, fimExclusivo });
});

it("preserva âncora bissexta e períodos com mais de um mês", () => {
  const anual = { ...regra, duracaoPeriodo: 12, referenciaCiclo: new Date("2024-02-29T00:00:00Z") };
  expect(periodoBeneficioReposicao(anual, "2027-03-01")).toEqual({ inicio: "2027-02-28", fimExclusivo: "2028-02-29" });
  expect(periodoBeneficioReposicao({ ...regra, duracaoPeriodo: 2 }, "2026-04-30")).toEqual({ inicio: "2026-03-31", fimExclusivo: "2026-05-31" });
});

it("períodos contíguos não deixam lacuna ou sobreposição", () => {
  let data = "2026-01-31";
  for (let i = 0; i < 36; i++) {
    const atual = periodoBeneficioReposicao(regra, data);
    const proximo = periodoBeneficioReposicao(regra, atual.fimExclusivo);
    expect(proximo.inicio).toBe(atual.fimExclusivo);
    expect(proximo.fimExclusivo > proximo.inicio).toBe(true);
    data = atual.fimExclusivo;
  }
});

it("dias corridos e mês civil conservam suas próprias fronteiras", () => {
  expect(periodoBeneficioReposicao({ ...regra, unidade: "DIAS", duracaoPeriodo: 7 }, "2026-02-07")).toEqual({ inicio: "2026-02-07", fimExclusivo: "2026-02-14" });
  expect(periodoBeneficioReposicao({ ...regra, referencia: "CIVIL", referenciaCiclo: null }, "2026-02-28")).toEqual({ inicio: "2026-02-01", fimExclusivo: "2026-03-01" });
});

it("recusa data inexistente, duração inválida e data anterior ao ciclo", () => {
  expect(() => periodoBeneficioReposicao(regra, "2026-02-30")).toThrow();
  expect(() => periodoBeneficioReposicao({ ...regra, duracaoPeriodo: 0 }, "2026-02-28")).toThrow();
  expect(() => periodoBeneficioReposicao(regra, "2026-01-30")).toThrow();
});
