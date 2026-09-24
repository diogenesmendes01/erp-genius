import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const mocks = vi.hoisted(() => ({ pathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: mocks.pathname }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  it("só aparece a partir de md (abaixo disso a navegação fica na barra mobile)", () => {
    mocks.pathname.mockReturnValue("/home");
    const html = renderToStaticMarkup(createElement(Sidebar, { papeis: [Papel.ADMINISTRADOR], nome: "Ana" }));
    expect(html).toMatch(/<aside[^>]*class="[^"]*\bhidden\b[^"]*\bmd:flex\b/);
  });

  it("\"Envios do portal\" usa o ícone de envelope, não o de Home (chave Mail)", () => {
    mocks.pathname.mockReturnValue("/home");
    const html = renderToStaticMarkup(createElement(Sidebar, { papeis: [Papel.ADMINISTRADOR], nome: "Ana" }));
    const link = html.match(/<a[^>]*href="\/secretaria\/envios-portal"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "";
    expect(link).toContain("tabler-icon-mail");
  });

  it("destaca só o item de prefixo mais longo, não os dois, em /financeiro/permuta", () => {
    mocks.pathname.mockReturnValue("/financeiro/permuta");
    const html = renderToStaticMarkup(createElement(Sidebar, { papeis: [Papel.ADMINISTRADOR], nome: "Ana" }));
    expect(html).toMatch(/<a(?=[^>]*\shref="\/financeiro\/permuta")(?=[^>]*\saria-current="page")(?=[^>]*\sclass="[^"]*bg-brand-50[^"]*")[^>]*>/);
    // Exatamente uma âncora marcada — se /financeiro (o prefixo mais curto) também
    // estivesse marcado, esse total seria 2, não 1. Cobre aria-current E a classe visual,
    // já que hoje o mesmo `ativo` dirige as duas — se um dia divergirem, este teste pega.
    const marcadosAtivos = [...html.matchAll(/aria-current="page"/g)];
    expect(marcadosAtivos).toHaveLength(1);
    const ancorasComClasseAtiva = [...html.matchAll(/<a[^>]*class="[^"]*bg-brand-50[^"]*"[^>]*>/g)];
    expect(ancorasComClasseAtiva).toHaveLength(1);
  });

  it("aria-current fica ausente quando nenhum item corresponde à rota atual", () => {
    mocks.pathname.mockReturnValue("/rota-sem-item-de-menu");
    const html = renderToStaticMarkup(createElement(Sidebar, { papeis: [Papel.ADMINISTRADOR], nome: "Ana" }));
    expect(html).not.toContain('aria-current="page"');
  });

  it("nav principal tem aria-label e o badge de não lidas tem texto para leitor de tela", () => {
    mocks.pathname.mockReturnValue("/inbox");
    const html = renderToStaticMarkup(createElement(Sidebar, { papeis: [Papel.ADMINISTRADOR], nome: "Ana", naoLidasInbox: 3 }));
    expect(html).toContain('aria-label="Navegação principal"');
    expect(html).toContain("mensagens não lidas");
  });
});
