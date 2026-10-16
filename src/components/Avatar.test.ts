import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Avatar, iniciais } from "./Avatar";

describe("Avatar", () => {
  it("iniciais: até duas letras maiúsculas", () => {
    expect(iniciais("maria da silva")).toBe("MS");
    expect(iniciais("  joão ")).toBe("J");
    expect(iniciais("Ana Beatriz Costa")).toBe("AC");
  });
  it("avatar sem nome mostra #; B2B quadrado", () => {
    const vazio = renderToStaticMarkup(createElement(Avatar, { nome: null }));
    expect(vazio).toContain(">#<");
    expect(vazio).toContain("rounded-full");
    expect(renderToStaticMarkup(createElement(Avatar, { nome: "   " }))).toContain(">#<");
    const b2b = renderToStaticMarkup(createElement(Avatar, { nome: "Escola Alfa", quadrado: true }));
    expect(b2b).toContain("rounded-md");
    expect(b2b).not.toContain("rounded-full");
    expect(b2b).toContain(">EA<");
  });
  it("cores de marca suave e tamanhos 32/40/48", () => {
    const h = renderToStaticMarkup(createElement(Avatar, { nome: "Ana" }));
    expect(h).toContain("bg-brand-bg");
    expect(h).toContain("text-brand-800");
    expect(h).toContain("h-10 w-10");
    expect(renderToStaticMarkup(createElement(Avatar, { nome: "Ana", tamanho: 32 }))).toContain("h-8 w-8");
    expect(renderToStaticMarkup(createElement(Avatar, { nome: "Ana", tamanho: 48 }))).toContain("h-12 w-12");
  });
});
