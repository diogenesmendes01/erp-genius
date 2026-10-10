import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PaginacaoFila, type CursorDoLink } from "./PaginacaoFila";
import { hrefLista } from "@/lib/pagina-url";

// Navegação das filas por cursor nos dois sentidos (E4, decisão de 10/10/2026).
const render = (anterior: string | null, proxima: string | null) =>
  renderToStaticMarkup(createElement(PaginacaoFila, { anterior, proxima, href: (c: CursorDoLink) => hrefLista("/x", { modo: "a", ...c }), rotulo: "Navegação da fila de x" }));

describe("PaginacaoFila", () => {
  it("sem para onde ir (fila numa página só, ou vazia): nada", () => {
    expect(render(null, null)).toBe("");
  });

  it("início da fila: só Próxima, com o cursor do último item; sem número de página", () => {
    const html = render(null, "f20");
    expect(html).toContain('aria-label="Navegação da fila de x"');
    expect(html).toContain('href="/x?modo=a&amp;depois=f20">Próxima →');
    expect(html).not.toContain("Anterior");
    expect(html).not.toContain("Página");
    expect(html).not.toContain("pagina");
  });

  it("no meio: Anterior com o cursor do primeiro item e Próxima com o do último, mantendo o filtro", () => {
    const html = render("f21", "f40");
    expect(html).toContain('href="/x?modo=a&amp;antes=f21">← Anterior');
    expect(html).toContain('href="/x?modo=a&amp;depois=f40">Próxima →');
  });

  it("fim da fila: só Anterior", () => {
    const html = render("f41", null);
    expect(html).toContain('href="/x?modo=a&amp;antes=f41">← Anterior');
    expect(html).not.toContain("Próxima");
  });
});
