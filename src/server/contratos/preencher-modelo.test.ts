import { expect, it } from "vitest";
import { preencherModelo } from "./preencher-modelo";
const modelo = {
  titulo: "Contrato de {{nome}}", finalidade: "CONTRATO", regimes: ["MENSALIDADE"], aplicacao: "Exemplo de teste",
  campos: [{ chave: "nome", descricao: "Nome", origem: "ALUNO_NOME" }, { chave: "valor", descricao: "Mensalidade", origem: "MENSALIDADE_VALOR" }],
  secoes: [{ titulo: "Dados de {{nome}}", texto: "Valor: {{valor}}. Nome: {{nome}}." }], assinaturas: [{ papel: "ALUNO", condicao: "SEMPRE" }],
};
it("resolve dados em títulos/texto e conserva origem e valor usados", () => {
  const r = preencherModelo(modelo, { ALUNO_NOME: "João", MENSALIDADE_VALOR: "120.50 BRL" });
  expect(r.titulo).toBe("Contrato de João");
  expect(r.secoes).toEqual([{ titulo: "Dados de João", texto: "Valor: 120.50 BRL. Nome: João." }]);
  expect(r.campos[1]).toEqual({ chave: "valor", origem: "MENSALIDADE_VALOR", valor: "120.50 BRL" });
});
it("não interpreta campos ou substituições dentro do valor cadastral", () => {
  const r = preencherModelo(modelo, { ALUNO_NOME: "{{valor}} $& <texto>", MENSALIDADE_VALOR: "100.00 CRC" });
  expect(r.titulo).toBe("Contrato de {{valor}} $& <texto>");
});
it("não inventa informação ausente nem aceita campo sem origem aprovada", () => {
  expect(() => preencherModelo(modelo, { ALUNO_NOME: "João" })).toThrow("Valor da mensalidade");
  expect(() => preencherModelo({ ...modelo, campos: [{ chave: "nome", descricao: "Nome" }, modelo.campos[1]] }, {})).toThrow("origem aprovada");
  expect(() => preencherModelo({ ...modelo, titulo: "{{nao_declarado}}" }, {})).toThrow("não declarado");
});
