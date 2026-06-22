import { describe, it, expect } from "vitest";
import { vagasTurma } from "./consultas";

/**
 * Capacidade/vagas devem considerar SOMENTE alocações ativas. Alocações inativas
 * (aluno transferido/removido) permanecem no histórico mas não ocupam vaga.
 */
describe("vagasTurma", () => {
  it("usa só a ocupação ativa (ignora histórico inativo)", () => {
    // Turma capacidade 10: 3 ativas + 4 inativas no histórico → ocupação ativa = 3.
    const ocupacaoAtiva = 3; // _count filtrado por { ativa: true }
    expect(vagasTurma(10, ocupacaoAtiva)).toBe(7);
  });

  it("turma cheia por alocações ativas não tem vaga", () => {
    expect(vagasTurma(8, 8)).toBe(0);
  });

  it("turma só com alocações inativas volta a ter todas as vagas", () => {
    // Todas as alocações foram desativadas → ocupação ativa = 0.
    expect(vagasTurma(6, 0)).toBe(6);
  });

  it("nunca retorna negativo mesmo se a ocupação exceder a capacidade", () => {
    expect(vagasTurma(5, 7)).toBe(0);
  });
});
