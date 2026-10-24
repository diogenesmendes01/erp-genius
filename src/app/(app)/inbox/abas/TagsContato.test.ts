import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { TagsContato, tagsParaEscolher, podeCriarTagComBusca } from "./TagsContato";
const props = { atendimentoId: "a1", tags: [{ id: "t1", rotulo: "Noite", ia: true }, { id: "t2", rotulo: "Inglês", ia: false }], disponiveis: [{ id: "t1", nome: "Noite" }, { id: "t3", nome: "Bolsista" }], podeEditar: true, podeCriar: false, aoMudar() {} };
const h = (extra: object = {}) => renderToStaticMarkup(createElement(TagsContato, { ...props, ...extra }));
it("D20 mantém a marca somente na tag sem autor e nomeia cada remoção", () => {
  const html = h(); expect(html.match(/aria-label="Criada pela Aria"/g)).toHaveLength(1);
  expect(html).toContain('aria-label="Remover tag Inglês"'); expect(html).toContain('aria-label="Remover tag Noite"');
});
it("sem capacidade mantém leitura e marca sem oferecer escrita; vazio não ocupa espaço", () => {
  const html = h({ podeEditar: false, podeCriar: true });
  expect(html).toContain("Inglês"); expect(html).toContain("Criada pela Aria"); expect(html).not.toContain("+ tag"); expect(html).not.toContain("Remover tag");
  expect(h({ tags: [], podeEditar: false })).toBe("");
});
it("escapa nomes recebidos em texto e rótulo de remoção", () => {
  const html = h({ tags: [{ id: "x", rotulo: '<img src=x onerror="x">', ia: false }] });
  expect(html).not.toContain("<img"); expect(html).toContain("&lt;img");
});
it("busca ignora caixa/acento e exclui vínculos por ID sem confundir nomes iguais", () => {
  expect(tagsParaEscolher([{ id: "t1", nome: "Matrícula" }, { id: "t9", nome: "Matrícula" }, { id: "t8", nome: "Outro" }], [{ id: "t1", rotulo: "Matrícula", ia: true }], "MATRI")).toEqual([{ id: "t9", nome: "Matrícula" }]);
});
it("limita oito sugestões sem limitar o catálogo que impede criar duplicata", () => {
  const catalogo = Array.from({ length: 12 }, (_, i) => ({ id: "t" + i, nome: "Tag " + i }));
  expect(tagsParaEscolher(catalogo, [], "Tag")).toHaveLength(8);
  expect(podeCriarTagComBusca(catalogo, " Tag 11 ")).toBe(false);
  expect(podeCriarTagComBusca([{ id: "x", nome: "Matrícula" }], "MATRICULA")).toBe(false);
  expect(podeCriarTagComBusca(catalogo, "   ")).toBe(false);
  expect(podeCriarTagComBusca(catalogo, "Nova")).toBe(true);
});
