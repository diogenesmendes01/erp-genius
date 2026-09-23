import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CampoFuso } from "./CampoFuso";

describe("CampoFuso", () => {
  it("pré-preenche com o fuso institucional quando ele existe", () => {
    const html = renderToStaticMarkup(createElement(CampoFuso, { padrao: "America/Sao_Paulo", className: "campo" }));
    expect(html).toContain('value="America/Sao_Paulo"');
    expect(html).not.toContain('value="UTC"');
  });

  it("sem fuso institucional configurado, fica vazio em vez de assumir um fuso plausível-mas-errado", () => {
    const html = renderToStaticMarkup(createElement(CampoFuso, { padrao: "", className: "campo" }));
    expect(html).toMatch(/<input[^>]*value=""/);
    expect(html).not.toContain('value="UTC"');
  });

  it("gera um datalist id próprio por instância na mesma árvore, mesmo com o mesmo name", () => {
    const html = renderToStaticMarkup(createElement("div", null,
      createElement(CampoFuso, { padrao: "", name: "fuso", className: "campo" }),
      createElement(CampoFuso, { padrao: "", name: "fuso", className: "campo" }),
    ));
    const listaIds = [...html.matchAll(/list="([^"]+)"/g)].map(m => m[1]);
    expect(listaIds).toHaveLength(2);
    expect(listaIds[0]).not.toBe(listaIds[1]);
  });
});
