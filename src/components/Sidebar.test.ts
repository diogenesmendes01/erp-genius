import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const mocks = vi.hoisted(() => ({ pathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: mocks.pathname }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  it("destaca só o item de prefixo mais longo, não os dois, em /financeiro/permuta", () => {
    mocks.pathname.mockReturnValue("/financeiro/permuta");
    const html = renderToStaticMarkup(createElement(Sidebar, { papeis: [Papel.ADMINISTRADOR], nome: "Ana" }));
    expect(html).toMatch(/<a(?=[^>]*\shref="\/financeiro\/permuta")(?=[^>]*\saria-current="page")[^>]*>/);
    // Exatamente uma âncora marcada — se /financeiro (o prefixo mais curto) também
    // estivesse marcado, esse total seria 2, não 1.
    const marcadosAtivos = [...html.matchAll(/aria-current="page"/g)];
    expect(marcadosAtivos).toHaveLength(1);
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
