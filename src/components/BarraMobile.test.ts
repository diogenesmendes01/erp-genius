import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: vi.fn(() => "/financeiro/permuta") }));
vi.mock("next/navigation", () => ({ usePathname: mocks.pathname }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

import { BarraMobile } from "./BarraMobile";

const render = (naoLidasInbox = 0) =>
  renderToStaticMarkup(createElement(BarraMobile, { papeis: [Papel.ADMINISTRADOR], nome: "Ana Souza", naoLidasInbox }));

describe("BarraMobile (shell abaixo de md)", () => {
  it("só aparece abaixo de md e oferece menu, tema, fuso e sair — o que a Sidebar escondida oferecia", () => {
    const html = render();
    expect(html).toMatch(/<header[^>]*class="[^"]*\bmd:hidden\b/);
    expect(html).toMatch(/<button[^>]*aria-label="Abrir menu"[^>]*aria-expanded="false"|<button[^>]*aria-expanded="false"[^>]*aria-label="Abrir menu"/);
    expect(html).toContain('aria-label="Alternar tema"');
    expect(html).toContain('href="/preferencias"');
    expect(html).toContain('aria-label="Sair"');
  });

  it("título da área = item ativo da navegação (prefixo mais longo)", () => {
    mocks.pathname.mockReturnValueOnce("/alunos/123/financeiro");
    expect(render()).toMatch(/<span[^>]*\btruncate\b[^>]*>Alunos<\/span>/);
    mocks.pathname.mockReturnValueOnce("/rota-sem-item");
    expect(render()).toMatch(/<span[^>]*\btruncate\b[^>]*>Genius<\/span>/);
  });

  it("a gaveta de navegação começa fechada: fora da árvore (sem role=dialog) e com a mesma lista da Sidebar", () => {
    const html = render();
    expect(html).not.toMatch(/role="dialog"/);
    expect(html).toContain('aria-label="Navegação principal"');
    expect(html).toContain('href="/alunos"');
    // Pela esquerda: fechada, fica deslocada para fora da tela à esquerda.
    expect(html).toMatch(/<aside[^>]*class="[^"]*\bleft-0\b[^"]*-translate-x-full/);
  });

  it("não lidas da inbox continuam visíveis no celular (ponto no botão de menu + texto para leitor de tela)", () => {
    expect(render(5)).toContain("5 mensagens não lidas");
    expect(render(0)).not.toContain("mensagens não lidas</span></span></button>");
  });
});
