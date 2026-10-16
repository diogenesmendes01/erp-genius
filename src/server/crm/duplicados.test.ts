import { describe, it, expect } from "vitest";
import { pontuarDuplicado, type PessoaComparavel } from "./duplicados";

const pc = (p: Partial<PessoaComparavel> = {}): PessoaComparavel => ({ id: "x", nome: "Ana", email: null, telefones: [], ...p });

describe("pontuarDuplicado", () => {
  it("pontuação", () => {
    expect(pontuarDuplicado(pc({ nome: "Beatriz Lima", telefones: ["+55119"] }), pc({ nome: "beatriz  lima", telefones: ["+55119"] }))).toEqual({ pontos: 140, motivos: ["telefone", "nome"] });
    expect(pontuarDuplicado(pc({ nome: "Ana" }), pc({ nome: "Bia" })).pontos).toBe(0);
  });
  it("e-mail vale 80 sem diferenciar caixa e e-mail nulo não casa", () => {
    expect(pontuarDuplicado(pc({ nome: "A", email: "a@x.com" }), pc({ nome: "B", email: "A@X.com" }))).toEqual({ pontos: 80, motivos: ["email"] });
    expect(pontuarDuplicado(pc({ nome: "A" }), pc({ nome: "B" })).motivos).toEqual([]);
  });
  it("só o nome (40) não chega ao limiar de 60, sem teto na soma", () => {
    expect(pontuarDuplicado(pc({ nome: "José" }), pc({ nome: "jose" })).pontos).toBe(40);
    expect(pontuarDuplicado(pc({ telefones: ["1"], email: "a@a" }), pc({ telefones: ["1"], email: "a@a" })).pontos).toBe(220);
  });
});
