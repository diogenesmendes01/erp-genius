import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ItemLista } from "./ItemLista";

const render = (p: Parameters<typeof ItemLista>[0]) => renderToStaticMarkup(createElement(ItemLista, p));

describe("ItemLista", () => {
  it("item de lista selecionado tem aria-current e trunca o título", () => {
    const h = render({ titulo: "Maria", resumo: "Quer matricular", selecionado: true, onClick: () => {} });
    expect(h).toContain('aria-current="true"');
    expect(h).toContain("bg-brand-bg text-brand-800");
    expect(h).toMatch(/truncate[^>]*>Maria</);
    expect(h).toMatch(/truncate[^>]*>Quer matricular</);
  });
  it("não selecionado: sem aria-current e com hover translúcido", () => {
    const h = render({ titulo: "João", onClick: () => {} });
    expect(h).not.toContain("aria-current");
    expect(h).toContain("hover:bg-highlight");
    for (const c of ["min-h-[76px]", "rounded-item", "p-3", "gap-3"]) expect(h).toContain(c);
  });
  it("com href vira link; sem href, botão", () => {
    expect(render({ titulo: "A", href: "/x" })).toMatch(/^<a [^>]*href="\/x"/);
    expect(render({ titulo: "A", onClick: () => {} })).toMatch(/^<button type="button"/);
  });
  it("mostra início e meta", () => {
    const h = render({ titulo: "A", inicio: "INI", meta: "10:32", onClick: () => {} });
    expect(h).toContain("INI");
    expect(h).toContain("10:32");
  });
});
