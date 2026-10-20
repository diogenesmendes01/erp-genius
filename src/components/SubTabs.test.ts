import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: mocks.pathname }));

import { SubTabs, mostrarAbaAtiva } from "./SubTabs";

const tabs = [
  { href: "/configuracao", label: "Geral" },
  { href: "/configuracao/whatsapp", label: "WhatsApp" },
];

describe("SubTabs", () => {
  it("destaca só a sub-aba de prefixo mais longo em /configuracao/whatsapp", () => {
    mocks.pathname.mockReturnValue("/configuracao/whatsapp");
    const html = renderToStaticMarkup(createElement(SubTabs, { tabs, ariaLabel: "Seções da configuração" }));
    expect(html).toMatch(/<a(?=[^>]*\shref="\/configuracao\/whatsapp")(?=[^>]*\saria-current="page")(?=[^>]*\sclass="[^"]*bg-brand-solid[^"]*")[^>]*>/);
    expect([...html.matchAll(/aria-current="page"/g)]).toHaveLength(1);
    expect([...html.matchAll(/class="[^"]*bg-brand-solid[^"]*"/g)]).toHaveLength(1);
  });

  it("aba ativa: fundo bg-brand-solid com texto on-brand; nunca bg-brand-500/600, que clareia no escuro (docs/43 §6 item 5)", () => {
    mocks.pathname.mockReturnValue("/configuracao/whatsapp");
    const html = renderToStaticMarkup(createElement(SubTabs, { tabs, ariaLabel: "Seções da configuração" }));
    const classeDe = (href: string) => html.match(new RegExp(`<a(?=[^>]*\\shref="${href}")[^>]*\\sclass="([^"]*)"`))?.[1].split(" ") ?? [];
    expect(classeDe("/configuracao/whatsapp")).toEqual(expect.arrayContaining(["bg-brand-solid", "font-medium", "text-on-brand"]));
    expect(classeDe("/configuracao")).not.toContain("bg-brand-solid");
    expect(classeDe("/configuracao")).not.toContain("text-white");
    expect(html).not.toMatch(/bg-brand-(?:500|600)/);
  });

  it("destaca a aba geral quando a rota é exatamente /configuracao", () => {
    mocks.pathname.mockReturnValue("/configuracao");
    const html = renderToStaticMarkup(createElement(SubTabs, { tabs, ariaLabel: "Seções da configuração" }));
    expect(html).toMatch(/<a(?=[^>]*\shref="\/configuracao")(?=[^>]*\saria-current="page")(?=[^>]*\sclass="[^"]*bg-brand-solid[^"]*")[^>]*>/);
    expect([...html.matchAll(/aria-current="page"/g)]).toHaveLength(1);
  });

  it("prefixos aninhados (E2, /academico): aba exata não acende por prefixo; `prefixo` cobre o ramo", () => {
    const aninhadas = [
      { href: "/academico", label: "Mudanças acadêmicas", exato: true },
      { href: "/academico/recuperacoes", label: "Recuperações" },
      { href: "/academico/recuperacoes/designadas", label: "Minhas recuperações" },
      { href: "/academico/modalidades/quantidade", label: "Quantidade de aulas", prefixo: "/academico/modalidades" },
    ];
    const marcadas = (caminho: string) => {
      mocks.pathname.mockReturnValue(caminho);
      const html = renderToStaticMarkup(createElement(SubTabs, { tabs: aninhadas, ariaLabel: "Seções do acadêmico" }));
      return [...html.matchAll(/<a[^>]*aria-current="page"[^>]*>/g)].map((m) => m[0].match(/\shref="([^"]+)"/)?.[1]);
    };
    expect(marcadas("/academico")).toEqual(["/academico"]);
    expect(marcadas("/academico/recuperacoes/designadas")).toEqual(["/academico/recuperacoes/designadas"]);
    expect(marcadas("/academico/recuperacoes/planos/p1")).toEqual(["/academico/recuperacoes"]);
    expect(marcadas("/academico/modalidades/m1/quantidade")).toEqual(["/academico/modalidades/quantidade"]);
    expect(marcadas("/academico/segundas-chamadas/a1/P1")).toEqual([]);
  });

  it("o aria-label recebido nomeia a navegação (C45: sem o antigo padrão \"Sub-navegação\")", () => {
    mocks.pathname.mockReturnValue("/configuracao");
    const html = renderToStaticMarkup(createElement(SubTabs, { tabs, ariaLabel: "Seções do WhatsApp" }));
    expect(html).toMatch(/^<nav class="[^"]*" aria-label="Seções do WhatsApp">/);
    expect(html).not.toContain("Sub-navegação");
  });

  it("todo <SubTabs> do app declara um aria-label literal próprio, sem repetir o de outra área (C45, #170)", () => {
    const usos = (readdirSync("src/app", { recursive: true }) as string[])
      .filter((f) => f.endsWith(".tsx"))
      .flatMap((f) => [...readFileSync(join("src/app", f), "utf-8").matchAll(/<SubTabs\b[^>]*>/g)].map((m) => ({ arquivo: f, tag: m[0] })));
    expect(usos.length).toBeGreaterThanOrEqual(6);
    const rotulos = usos.map(({ arquivo, tag }) => {
      const r = /\bariaLabel="([^"]+)"/.exec(tag)?.[1];
      expect(r, `${arquivo}: ${tag}`).toBeTruthy();
      expect(r, arquivo).not.toBe("Sub-navegação");
      return r;
    });
    expect(new Set(rotulos).size, rotulos.join(" | ")).toBe(rotulos.length);
  });

  it("sub-aba ativa é pílula sólida com text-on-brand", () => {
    mocks.pathname.mockReturnValue("/configuracao/whatsapp");
    const html = renderToStaticMarkup(createElement(SubTabs, { tabs, ariaLabel: "Seções da configuração" }));
    const classeDe = (href: string) => html.match(new RegExp(`<a(?=[^>]*\\shref="${href}")[^>]*\\sclass="([^"]*)"`))?.[1].split(" ") ?? [];
    expect(classeDe("/configuracao/whatsapp")).toEqual(expect.arrayContaining(["rounded-full", "px-3", "py-1.5", "max-sm:min-h-11", "bg-brand-solid", "text-on-brand", "font-medium"]));
    expect(classeDe("/configuracao")).toEqual(expect.arrayContaining(["rounded-full", "text-gray-600", "hover:bg-highlight"]));
  });

  it("a 375 px as abas ficam numa faixa só, rolável na horizontal, em vez de quebrar em várias linhas (C45, #170)", () => {
    mocks.pathname.mockReturnValue("/configuracao");
    const html = renderToStaticMarkup(createElement(SubTabs, { tabs, ariaLabel: "Seções da configuração" }));
    const nav = html.match(/^<nav class="([^"]*)"/)?.[1].split(" ") ?? [];
    expect(nav).toEqual(expect.arrayContaining(["flex", "max-sm:flex-nowrap", "max-sm:overflow-x-auto", "max-sm:p-1", "sm:flex-wrap"]));
    expect(nav).not.toContain("flex-wrap"); // sem quebra incondicional
    const links = [...html.matchAll(/<a[^>]*\sclass="([^"]*)"/g)].map((m) => m[1].split(" "));
    expect(links).toHaveLength(2);
    for (const c of links) expect(c).toEqual(expect.arrayContaining(["shrink-0", "whitespace-nowrap"]));
  });

  it("a aba ativa é trazida para a vista dentro da faixa, sem rolar a página na vertical", () => {
    const rolar = vi.fn();
    const nav = { querySelector: vi.fn(() => ({ scrollIntoView: rolar })) };
    mostrarAbaAtiva(nav as unknown as HTMLElement);
    expect(nav.querySelector).toHaveBeenCalledWith('[aria-current="page"]');
    expect(rolar).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
    // Sem aba ativa (rota fora das abas) ou sem nav montada: nada a fazer, sem erro.
    expect(() => mostrarAbaAtiva({ querySelector: () => null } as unknown as HTMLElement)).not.toThrow();
    expect(() => mostrarAbaAtiva(null)).not.toThrow();
  });
});
