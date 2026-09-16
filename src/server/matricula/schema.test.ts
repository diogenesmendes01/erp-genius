import { describe, it, expect } from "vitest";
import { MatriculaSchema } from "./schema";

// Base mínima válida para focar nos campos da exceção de preço (Issue #7).
function base(over: Record<string, unknown> = {}) {
  return {
    alunoPrimeiroNome: "Aluno",
    alunoSobrenome: "Teste",
    alunoNascimento: "2000-01-01",
    alunoGenero: "MASCULINO",
    alunoPaisId: "pais-1",
    alunoTipoDocumentoId: "tipodoc-1",
    alunoDocumento: "123456",
    alunoNacionalidade: "CR",
    alunoEmail: "aluno@teste.com",
    alunoTelefone: "+50688887777",
    alunoPaisResidencia: "CR",
    produtoId: "prod-1",
    diaVencimento: 5,
    cobertura: { referencia: "MES_CIVIL" as const, inicio: "2026-06-01" }, primeiroVencimento: "2026-06-05",
    taxaValor: 100,
    mensalidadeValor: 200,
    ...over,
  };
}

describe("MatriculaSchema — exceção de preço", () => {
  it("cobertura explícita exige primeiro vencimento válido sem inferir a data", () => {
    const cobertura = { referencia: "MES_CIVIL", inicio: "2028-02-01" };
    expect(MatriculaSchema.safeParse(base({ cobertura, primeiroVencimento: undefined })).success).toBe(false);
    expect(MatriculaSchema.safeParse(base({ cobertura, primeiroVencimento: "2028-02-30" })).success).toBe(false);
    expect(MatriculaSchema.safeParse(base({ cobertura, primeiroVencimento: "2028-02-29" })).success).toBe(true);
  });
  it("aceita dias de 1 a 31 e rejeita referências inválidas", () => {
    for (let dia = 1; dia <= 31; dia++) expect(MatriculaSchema.safeParse(base({ diaVencimento: dia })).success).toBe(true);
    for (const dia of [0, 32, 1.5]) expect(MatriculaSchema.safeParse(base({ diaVencimento: dia })).success).toBe(false);
  });
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
