import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Avatar, iniciais, tomDoAvatar } from "./Avatar";

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


describe("Avatar do Inbox", () => {
  it.each([["+55 11 98765-4321", ""], ["😀", ""], ["😀 Ana", "A"], ["Ana 😀 Costa", "AC"], ["12 Ana 7 Costa", "AC"], ["𐐀 Silva", "𐐀S"]])("iniciais com letras Unicode: %s", (nome, esperado) => {
    expect(iniciais(nome)).toBe(esperado);
  });
  it.each([
    ["ßeta Anna", "SA"], ["Anna ßeta", "AS"], ["ﬃona Anna", "FA"], ["ﬃona", "F"],
    ["ßeta 𐐨erta", "S𐐀"], ["𐐨erta Anna", "𐐀A"], ["𐐨erta 𐐩lfa", "𐐀𐐁"],
  ])("maiúsculas mantêm um ponto Unicode por inicial: %s", (nome, esperado) => {
    const resultado = iniciais(nome);
    expect(resultado).toBe(esperado);
    expect(Array.from(resultado).length).toBeLessThanOrEqual(2);
    expect(renderToStaticMarkup(createElement(Avatar, { nome }))).toContain(">" + esperado + "<");
  });
  it("número sem nome renderiza # sem quebrar surrogate", () => {
    expect(renderToStaticMarkup(createElement(Avatar, { nome: "+55 11 98765-4321" }))).toContain(">#<");
  });
  it("tom aplica fundo gerado e iniciais brancas com44px", () => {
    const h = renderToStaticMarkup(createElement(Avatar, { nome: "Ana", tom: 3, tamanho: 44 }));
    for (const classe of ["bg-avatar-3", "text-white", "h-11", "w-11", "font-semibold"]) expect(h).toContain(classe);
    expect(h).not.toContain("bg-brand-bg");
  });
  it("painel132px tem texto44/peso500/tracking e raio34 no quadrado", () => {
    const h = renderToStaticMarkup(createElement(Avatar, { nome: "Ana", tom: 1, tamanho: 132, quadrado: true }));
    for (const classe of ["h-[132px]", "w-[132px]", "text-[44px]", "font-medium", "tracking-[-0.01em]", "rounded-[34px]"]) expect(h).toContain(classe);
    expect(renderToStaticMarkup(createElement(Avatar, { nome: "Ana", tamanho: 44, quadrado: true }))).toContain("rounded-lg");
  });
  it("seloIA19px tem borda da superfície, deslocamento e ícone10", () => {
    const h = renderToStaticMarkup(createElement(Avatar, { nome: "Ana", tom: 1, tamanho: 44, selo: "ia" }));
    for (const classe of ["relative", "h-[19px]", "w-[19px]", "bg-ai-solid", "border-2", "border-surface", "-bottom-[3px]", "-right-[3px]"]) expect(h).toContain(classe);
    expect(h).toContain('width="10"');
  });
  it("hashFNV1a é estável de1a8 e todos os tons são renderizáveis", () => {
    expect(["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"].map(tomDoAvatar)).toEqual([2, 1, 4, 3, 6, 5, 8, 7]);
    expect(tomDoAvatar("contato-a")).toBe(4);
    for (let tom = 1; tom <= 8; tom++) expect(renderToStaticMarkup(createElement(Avatar, { nome: "Ana", tom }))).toContain("bg-avatar-" + tom);
  });
});
