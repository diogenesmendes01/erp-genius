import { expect, it } from "vitest";
import { identidadeCadastralAditivo } from "./identidade-cadastral-aditivo";
const base = { nome: "Nome original", email: "original@example.test", documento: "DOC1" };
it("projeta alteração estruturada aprovada sem modificar a identidade compartilhada", () => {
  const atual = identidadeCadastralAditivo(base, "ALUNO", null, [{ origem: "ALUNO_NOME", novo: "Nome contratual", valorEstruturado: { tipo: "TEXT", texto: "Nome contratual" } }]);
  expect(atual).toEqual({ ...base, nome: "Nome contratual" });
  expect(base.nome).toBe("Nome original");
});
it("conserva alteração anterior aplicada e não mistura aluno com pagador", () => {
  const anteriores = { ALUNO_EMAIL: { tipo: "EMAIL", email: "contrato@example.test" }, PAGADOR_NOME: { tipo: "TEXT", texto: "Empresa" } };
  expect(identidadeCadastralAditivo(base, "ALUNO", anteriores, [])).toEqual({ ...base, email: "contrato@example.test" });
  expect(identidadeCadastralAditivo(base, "PAGADOR", anteriores, [])).toEqual({ ...base, nome: "Empresa" });
});
it("não aceita texto divergente ou substituição legada não estruturada", () => {
  expect(() => identidadeCadastralAditivo(base, "ALUNO", null, [{ origem: "ALUNO_NOME", novo: "Outro" }])).toThrow("Estruture");
  expect(() => identidadeCadastralAditivo(base, "ALUNO", null, [{ origem: "ALUNO_NOME", novo: "Outro", valorEstruturado: { tipo: "TEXT", texto: "Terceiro" } }])).toThrow("diverge");
});
it("valida tipo e formato do e-mail e preserva legado sem mudança", () => {
  expect(() => identidadeCadastralAditivo(base, "ALUNO", null, [{ origem: "ALUNO_EMAIL", novo: "inválido", valorEstruturado: { tipo: "EMAIL", email: "inválido" } }])).toThrow();
  expect(identidadeCadastralAditivo(base, "ALUNO", null, [{ origem: "ALUNO_NOME", novo: base.nome }])).toEqual(base);
});
