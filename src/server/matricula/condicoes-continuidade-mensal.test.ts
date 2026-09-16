import { describe, expect, it } from "vitest";
import { impedimentoPreparacaoMensal } from "./condicoes-continuidade-fonte";

describe("impedimentoPreparacaoMensal", () => {
  it("exige preparação mensal explícita", () => {
    expect(impedimentoPreparacaoMensal(null)).toMatch(/Prepare a contratação mensal/);
    expect(impedimentoPreparacaoMensal("HORA_PARTICULAR")).toBe("Esta contratação não é mensal.");
    expect(impedimentoPreparacaoMensal("MENSALIDADE")).toBeNull();
  });
});
