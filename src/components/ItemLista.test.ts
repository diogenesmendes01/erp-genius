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
  it("tamanho sm é mais baixo, com hover de superfície e meta mono", () => {
    const h = render({ titulo: "Ana", tamanho: "sm", meta: "10:32", onClick: () => {} });
    for (const c of ["min-h-[52px]", "gap-2.5", "rounded-lg", "px-2.5", "py-2", "hover:bg-surface-muted", "font-mono", "text-[11.5px]", "tabular-nums"]) expect(h).toContain(c);
    expect(h).not.toContain("min-h-[76px]");
    expect(h).not.toContain("hover:bg-highlight");
    const ativo = render({ titulo: "Ana", tamanho: "sm", selecionado: true, onClick: () => {} });
    expect(ativo).toContain("bg-brand-bg text-brand-800");
    expect(ativo).not.toContain("hover:bg-surface-muted");
  });
  it("badges ficam ao lado do título e metaMono aplica mono no tamanho md", () => {
    const h = render({ titulo: "Ana", badges: "NOVO", meta: "R$ 10", metaMono: true, onClick: () => {} });
    expect(h).toContain("NOVO");
    expect(h).toMatch(/truncate[^>]*>Ana</);
    expect(h.indexOf(">Ana<")).toBeLessThan(h.indexOf("NOVO"));
    expect(h).toContain("min-h-[76px]");
    expect(h).toContain('class="shrink-0 self-start font-mono text-[11.5px] tabular-nums text-gray-600">R$ 10<');
  });
});
