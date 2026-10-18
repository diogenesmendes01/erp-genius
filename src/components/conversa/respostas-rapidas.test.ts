import { describe, expect, it } from "vitest";
import { aplicarVariaveisResposta, respostasDoAtalho } from "./respostas-rapidas";

const rs = [
  { id: "1", atalho: "/preco", titulo: "Preço", corpo: "a" },
  { id: "2", atalho: "/prazo", titulo: "Prazo", corpo: "b" },
  { id: "3", atalho: "/boleto", titulo: "Boleto", corpo: "c" },
];
describe("respostas rápidas no compositor", () => {
  it("filtra pelo prefixo depois da barra", () => {
    expect(respostasDoAtalho("/", rs)).toHaveLength(3);
    expect(respostasDoAtalho("/pr", rs).map((r) => r.id)).toEqual(["1", "2"]);
    expect(respostasDoAtalho("/PRE", rs).map((r) => r.id)).toEqual(["1"]);
  });
  it("não abre sem barra inicial nem com espaço", () => {
    expect(respostasDoAtalho("oi /pr", rs)).toEqual([]);
    expect(respostasDoAtalho("/preco x", rs)).toEqual([]);
    expect(respostasDoAtalho("", rs)).toEqual([]);
  });
  it("aplica só as variáveis conhecidas e mantém as sem valor", () => {
    expect(aplicarVariaveisResposta("Oi {nome}, {responsavel} fala do {curso}", { nome: "Ana", responsavel: "  " })).toBe("Oi Ana, {responsavel} fala do {curso}");
  });
});
