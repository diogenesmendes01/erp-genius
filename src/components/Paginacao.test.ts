import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Paginacao } from "./Paginacao";
import { sincronizarCamposFiltro } from "@/lib/filtros-url";

const render = (pagina: number, temProxima: boolean) =>
  renderToStaticMarkup(createElement(Paginacao, { pagina, temProxima, href: (p: number) => (p > 1 ? `/x?pagina=${p}` : "/x"), rotulo: "Páginas de x" }));

describe("Paginacao", () => {
  it("uma página só: nada", () => {
    expect(render(1, false)).toBe("");
  });

  it("primeira página com mais: só Próxima", () => {
    const html = render(1, true);
    expect(html).toContain('aria-label="Páginas de x"');
    expect(html).toContain('href="/x?pagina=2"');
    expect(html).not.toContain("Anterior");
  });

  it("no meio: Anterior e Próxima; página atual marcada", () => {
    const html = render(3, true);
    expect(html).toContain('href="/x?pagina=2"');
    expect(html).toContain('href="/x?pagina=4"');
    expect(html).toMatch(/aria-current="page"[^>]*>Página 3</);
  });

  it("última: só Anterior (a da página 2 volta para a 1 sem `pagina`)", () => {
    const html = render(2, false);
    expect(html).toContain('href="/x"');
    expect(html).not.toContain("Próxima");
  });
});

describe("sincronizarCamposFiltro", () => {
  it("só atualiza os campos cujo filtro mudou na URL; o que está sendo digitado sobrevive", () => {
    const antes = { busca: "ana", status: "" };
    const depois = { busca: "ana", status: "ATIVO" };
    expect(sincronizarCamposFiltro({ busca: "ana mar", status: "" }, antes, depois)).toEqual({ busca: "ana mar", status: "ATIVO" });
    expect(sincronizarCamposFiltro({ busca: "ana mar", status: "" }, antes, { busca: "", status: "" })).toEqual({ busca: "", status: "" });
  });
});
