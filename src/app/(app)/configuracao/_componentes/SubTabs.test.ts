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
    expect(html).toMatch(/<a(?=[^>]*\shref="\/configuracao\/whatsapp")(?=[^>]*\saria-current="page")(?=[^>]*\sclass="[^"]*bg-brand-600[^"]*")[^>]*>/);
    expect([...html.matchAll(/aria-current="page"/g)]).toHaveLength(1);
    expect([...html.matchAll(/class="[^"]*bg-brand-600[^"]*"/g)]).toHaveLength(1);
  });

  it("destaca a aba geral quando a rota é exatamente /configuracao", () => {
    mocks.pathname.mockReturnValue("/configuracao");
    const html = renderToStaticMarkup(createElement(SubTabs, { tabs }));
    expect(html).toMatch(/<a(?=[^>]*\shref="\/configuracao")(?=[^>]*\saria-current="page")(?=[^>]*\sclass="[^"]*bg-brand-600[^"]*")[^>]*>/);
    expect([...html.matchAll(/aria-current="page"/g)]).toHaveLength(1);
  });

  it("aceita um aria-label próprio para distinguir mais de um SubTabs na mesma página", () => {
    mocks.pathname.mockReturnValue("/configuracao");
    const semLabel = renderToStaticMarkup(createElement(SubTabs, { tabs }));
    expect(semLabel).toContain('aria-label="Sub-navegação"');
    const comLabel = renderToStaticMarkup(createElement(SubTabs, { tabs, ariaLabel: "Sub-navegação de canais" }));
    expect(comLabel).toContain('aria-label="Sub-navegação de canais"');
  });
});
