import { describe, expect, it } from "vitest";
import { selecionarFonteContinuidade } from "./continuidade-precedencia";
describe("precedência temporal da continuidade", () => {
  it("usa retomada ou recomposição posteriores sem restaurar política antiga", () => {
    expect(selecionarFonteContinuidade([{ tipo: "ADITIVO", aplicadaEm: "2026-01-02T10:00:00.000Z" }, { tipo: "RETOMADA", aplicadaEm: "2026-02-02T10:00:00.000Z" }])).toBe("RETOMADA");
    expect(selecionarFonteContinuidade([{ tipo: "ADITIVO", aplicadaEm: "2026-03-02T10:00:00.000Z" }, { tipo: "RECOMPOSICAO", aplicadaEm: "2026-02-02T10:00:00.000Z" }])).toBe("ADITIVO");
  });
  it("recusa empate de fontes aplicadas", () => {
    expect(() => selecionarFonteContinuidade([{ tipo: "ADITIVO", aplicadaEm: "2026-03-02T10:00:00.000Z" }, { tipo: "RECOMPOSICAO", aplicadaEm: "2026-03-02T10:00:00.000Z" }])).toThrow(/mesmo instante/);
  });
});