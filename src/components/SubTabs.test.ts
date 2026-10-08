import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: mocks.pathname }));

import { SubTabs } from "./SubTabs";

const tabs = [
  { href: "/configuracao", label: "Geral" },
  { href: "/configuracao/whatsapp", label: "WhatsApp" },
];

describe("SubTabs", () => {
  it("destaca só a sub-aba de prefixo mais longo em /configuracao/whatsapp", () => {
    mocks.pathname.mockReturnValue("/configuracao/whatsapp");
    const html = renderToStaticMarkup(createElement(SubTabs, { tabs }));
    expect(html).toMatch(/<a(?=[^>]*\shref="\/configuracao\/whatsapp")(?=[^>]*\saria-current="page")(?=[^>]*\sclass="[^"]*bg-brand-solid[^"]*")[^>]*>/);
    expect([...html.matchAll(/aria-current="page"/g)]).toHaveLength(1);
    expect([...html.matchAll(/class="[^"]*bg-brand-solid[^"]*"/g)]).toHaveLength(1);
  });

  it("aba ativa: fundo bg-brand-solid com texto branco; nunca bg-brand-500/600, que clareia no escuro (docs/43 §6 item 5)", () => {
    mocks.pathname.mockReturnValue("/configuracao/whatsapp");
    const html = renderToStaticMarkup(createElement(SubTabs, { tabs }));
    const classeDe = (href: string) => html.match(new RegExp(`<a(?=[^>]*\\shref="${href}")[^>]*\\sclass="([^"]*)"`))?.[1].split(" ") ?? [];
    expect(classeDe("/configuracao/whatsapp")).toEqual(expect.arrayContaining(["bg-brand-solid", "font-medium", "text-white"]));
    expect(classeDe("/configuracao")).not.toContain("bg-brand-solid");
    expect(classeDe("/configuracao")).not.toContain("text-white");
    expect(html).not.toMatch(/bg-brand-(?:500|600)/);
  });

  it("destaca a aba geral quando a rota é exatamente /configuracao", () => {
    mocks.pathname.mockReturnValue("/configuracao");
    const html = renderToStaticMarkup(createElement(SubTabs, { tabs }));
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
      const html = renderToStaticMarkup(createElement(SubTabs, { tabs: aninhadas }));
      return [...html.matchAll(/<a[^>]*aria-current="page"[^>]*>/g)].map((m) => m[0].match(/\shref="([^"]+)"/)?.[1]);
    };
    expect(marcadas("/academico")).toEqual(["/academico"]);
    expect(marcadas("/academico/recuperacoes/designadas")).toEqual(["/academico/recuperacoes/designadas"]);
    expect(marcadas("/academico/recuperacoes/planos/p1")).toEqual(["/academico/recuperacoes"]);
    expect(marcadas("/academico/modalidades/m1/quantidade")).toEqual(["/academico/modalidades/quantidade"]);
    expect(marcadas("/academico/segundas-chamadas/a1/P1")).toEqual([]);
  });

  it("aceita um aria-label próprio para distinguir mais de um SubTabs na mesma página", () => {
    mocks.pathname.mockReturnValue("/configuracao");
    const semLabel = renderToStaticMarkup(createElement(SubTabs, { tabs }));
    expect(semLabel).toContain('aria-label="Sub-navegação"');
    const comLabel = renderToStaticMarkup(createElement(SubTabs, { tabs, ariaLabel: "Sub-navegação de canais" }));
    expect(comLabel).toContain('aria-label="Sub-navegação de canais"');
  });
});
