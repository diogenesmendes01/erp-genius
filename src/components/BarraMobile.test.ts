import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: vi.fn(() => "/financeiro/permuta") }));
vi.mock("next/navigation", () => ({ usePathname: mocks.pathname }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

import { BarraMobile, rotuloBotaoMenu } from "./BarraMobile";

const render = (naoLidasInbox = 0) =>
  renderToStaticMarkup(createElement(BarraMobile, { papeis: [Papel.ADMINISTRADOR], nome: "Ana Souza", naoLidasInbox }));

describe("BarraMobile (shell abaixo de md)", () => {
  it("só aparece abaixo de md e oferece menu, tema, fuso e sair — o que a Sidebar escondida oferecia", () => {
    const html = render();
    expect(html).toMatch(/<header[^>]*class="[^"]*\bmd:hidden\b/);
    expect(html).toMatch(/<button[^>]*aria-label="Abrir menu"[^>]*aria-expanded="false"|<button[^>]*aria-expanded="false"[^>]*aria-label="Abrir menu"/);
    expect(html).toContain('aria-label="Alternar tema"');
    expect(html).toMatch(/<button[^>]*aria-label="Alternar tema"[^>]*aria-pressed="false"/);
    expect(html).toContain('href="/preferencias"');
    expect(html).toContain('aria-label="Sair"');
  });

  it("todo controle da barra tem alvo de toque ≥ 40px (min-h-10 e min-w-10)", () => {
    const html = render();
    const cabecalho = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
    const controles = [...cabecalho.matchAll(/<(?:button|a)\b[^>]*>/g)].map((m) => m[0]);
    expect(controles).toHaveLength(4);
    for (const c of controles) expect(c).toMatch(/class="(?=[^"]*\bmin-h-10\b)(?=[^"]*\bmin-w-10\b)[^"]*"/);
    expect(cabecalho).not.toMatch(/tabler-icon[^"]*\bh-[45]\b/);
  });

  it("estados da barra seguem os da sidebar e chegam a 44px de toque abaixo de sm", () => {
    const html = render();
    const cabecalho = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
    expect(cabecalho).toMatch(/<header[^>]*class="[^"]*\bbg-surface-muted\b/);
    const controles = [...cabecalho.matchAll(/<(?:button|a)\b[^>]*>/g)].map((m) => m[0]);
    expect(controles).toHaveLength(4);
    for (const c of controles) {
      expect(c).toMatch(/class="(?=[^"]*\brounded-item\b)(?=[^"]*\bhover:bg-highlight\b)(?=[^"]*\bmax-sm:min-h-11\b)(?=[^"]*\bmax-sm:min-w-11\b)[^"]*"/);
    }
    const gaveta = html.match(/<nav[^>]*aria-label="Menu de navegação"[\s\S]*?<\/nav>/)?.[0] ?? "";
    const itens = [...gaveta.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
    expect(itens.length).toBeGreaterThan(0);
    for (const i of itens) expect(i).toMatch(/class="(?=[^"]*\bmin-h-10\b)(?=[^"]*\bmax-sm:min-h-11\b)(?=[^"]*\brounded-item\b)[^"]*"/);
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
    expect(html).toContain('aria-label="Menu de navegação"');
    expect(html).toMatch(/<button[^>]*aria-controls="menu-navegacao"/);
    expect(html).toMatch(/<aside[^>]*id="menu-navegacao"/);
    expect(html).toContain('href="/alunos"');
    expect(html).toMatch(/<aside[^>]*class="[^"]*\bleft-0\b[^"]*-translate-x-full/);
  });

  it("não lidas da inbox: ponto visual + NOME ACESSÍVEL do botão (o aria-label substitui texto interno)", () => {
    const botao = (html: string) => html.match(/<button[^>]*aria-haspopup="dialog"[^>]*>/)?.[0] ?? "";
    expect(botao(render(5))).toContain('aria-label="Abrir menu, 5 conversas não lidas"');
    expect(botao(render(1))).toContain('aria-label="Abrir menu, 1 conversa não lida"');
    expect(botao(render(0))).toContain('aria-label="Abrir menu"');
    const conteudo = render(5).match(/<button[^>]*aria-haspopup="dialog"[^>]*>([\s\S]*?)<\/button>/)?.[1] ?? "";
    expect(conteudo).not.toContain("sr-only");
  });

  it("rótulo do botão de menu acompanha o estado", () => {
    expect(rotuloBotaoMenu(true, 5)).toBe("Fechar menu");
    expect(rotuloBotaoMenu(false, 150)).toBe("Abrir menu, 99+ conversas não lidas");
  });
});
