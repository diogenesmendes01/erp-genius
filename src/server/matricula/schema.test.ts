import { describe, it, expect } from "vitest";
import { MatriculaSchema } from "./schema";

// Base mínima válida para focar nos campos da exceção de preço (Issue #7).
function base(over: Record<string, unknown> = {}) {
  return {
    alunoNome: "Aluno Teste",
    alunoPaisId: "pais-1",
    produtoId: "prod-1",
    diaVencimento: 5,
    taxaValor: 100,
    mensalidadeValor: 200,
    ...over,
  };
}

describe("MatriculaSchema — exceção de preço", () => {
  it("não expõe mais um boolean livre excecaoPreco", () => {
    const dados = MatriculaSchema.parse(base()) as Record<string, unknown>;
    expect("excecaoPreco" in dados).toBe(false);
  });

  it('a string "false" NÃO é coagida para true (bug do z.coerce.boolean)', () => {
    // justificativaSemPreco é texto puro: "false" permanece a string "false",
    // jamais um boolean true que pularia o bloqueio de preço.
    const dados = MatriculaSchema.parse(base({ justificativaSemPreco: "false" }));
    expect(dados.justificativaSemPreco).toBe("false");
    // Sanidade: o tipo é string, não boolean.
    expect(typeof dados.justificativaSemPreco).toBe("string");
  });

  it("aceita justificativa textual e a normaliza (trim)", () => {
    const dados = MatriculaSchema.parse(
      base({ justificativaSemPreco: "  Cliente B2B sem tabela  " }),
    );
    expect(dados.justificativaSemPreco).toBe("Cliente B2B sem tabela");
  });

  it("justificativa é opcional (ausência = sem exceção)", () => {
    const dados = MatriculaSchema.parse(base());
    expect(dados.justificativaSemPreco).toBeUndefined();
  });
});
