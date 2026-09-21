import { expect, it } from "vitest";
import { projetarCadastroContratual } from "./cadastro-contratual";
import { hashSubstituicao } from "./substituicao-estado";
const condicoes = { ALUNO_NOME: { tipo: "TEXT", texto: "Nome contratual" }, PAGADOR_EMAIL: { tipo: "EMAIL", email: "pagador@example.test" }, MENSALIDADE_VALOR: { tipo: "DINHEIRO", valor: "100", moeda: "BRL" } };
const condicoesHash = hashSubstituicao(condicoes);
const versao = { matriculaId: "contrato-a", versao: 2, vigenciaInicio: new Date("2026-10-01T00:00:00Z"), condicoes, condicoesHash, aplicacao: { id: "aplicacao", condicoesHash } };
it("mantém campos próprios do contrato sem projetar condições financeiras", () => {
  const antes = JSON.stringify(versao);
  expect(projetarCadastroContratual("contrato-a", versao, versao.vigenciaInicio)).toMatchObject({ estado: "VIGENCIA_INICIADA", campos: { ALUNO_NOME: "Nome contratual", PAGADOR_EMAIL: "pagador@example.test" } });
  expect(projetarCadastroContratual("contrato-a", versao, versao.vigenciaInicio)?.campos).not.toHaveProperty("MENSALIDADE_VALOR");
  expect(JSON.stringify(versao)).toBe(antes);
});
it("não trata formalização sem aplicação como cadastro operacional", () => {
  expect(projetarCadastroContratual("contrato-a", { ...versao, aplicacao: null }, versao.vigenciaInicio)).toBeNull();
});
it("distingue programação futura da vigência exata", () => {
  expect(projetarCadastroContratual("contrato-a", versao, new Date(versao.vigenciaInicio.getTime() - 1))?.estado).toBe("PROGRAMADO");
  expect(projetarCadastroContratual("contrato-a", versao, versao.vigenciaInicio)?.estado).toBe("VIGENCIA_INICIADA");
});
it("recusa outro contrato e hashes adulterados", () => {
  expect(() => projetarCadastroContratual("contrato-b", versao, versao.vigenciaInicio)).toThrow();
  expect(() => projetarCadastroContratual("contrato-a", { ...versao, condicoesHash: "outro" }, versao.vigenciaInicio)).toThrow();
  expect(() => projetarCadastroContratual("contrato-a", { ...versao, aplicacao: { id: "aplicacao", condicoesHash: "outro" } }, versao.vigenciaInicio)).toThrow();
});
