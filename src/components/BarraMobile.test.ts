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
    expect(html).toContain('href="/preferencias"');
    expect(html).toContain('aria-label="Sair"');
  });

  it("todo controle da barra tem alvo de toque ≥ 40px (min-h-10 e min-w-10)", () => {
    const html = render();
    const cabecalho = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
    const controles = [...cabecalho.matchAll(/<(?:button|a)\b[^>]*>/g)].map((m) => m[0]);
    expect(controles).toHaveLength(4); // menu, tema, fuso, sair
    for (const c of controles) expect(c).toMatch(/class="(?=[^"]*\bmin-h-10\b)(?=[^"]*\bmin-w-10\b)[^"]*"/);
    // Ícones da barra em 24px (h-6), inclusive o do tema, que na Sidebar é menor.
    expect(cabecalho).not.toMatch(/tabler-icon[^"]*\bh-[45]\b/);
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
    // Rótulo próprio: não se confunde com a "Navegação principal" da Sidebar.
    expect(html).toContain('aria-label="Menu de navegação"');
    // O botão aponta para o painel que controla.
    expect(html).toMatch(/<button[^>]*aria-controls="menu-navegacao"/);
    expect(html).toMatch(/<aside[^>]*id="menu-navegacao"/);
    expect(html).toContain('href="/alunos"');
    // Pela esquerda: fechada, fica deslocada para fora da tela à esquerda.
    expect(html).toMatch(/<aside[^>]*class="[^"]*\bleft-0\b[^"]*-translate-x-full/);
  });

  it("não lidas da inbox: ponto visual + NOME ACESSÍVEL do botão (o aria-label substitui texto interno)", () => {
    const botao = (html: string) => html.match(/<button[^>]*aria-haspopup="dialog"[^>]*>/)?.[0] ?? "";
    expect(botao(render(5))).toContain('aria-label="Abrir menu, 5 mensagens não lidas"');
    expect(botao(render(1))).toContain('aria-label="Abrir menu, 1 mensagem não lida"');
    expect(botao(render(0))).toContain('aria-label="Abrir menu"');
    // Nenhum texto sr-only escondido atrás do aria-label (leitor de tela não o anunciaria).
    const conteudo = render(5).match(/<button[^>]*aria-haspopup="dialog"[^>]*>([\s\S]*?)<\/button>/)?.[1] ?? "";
    expect(conteudo).not.toContain("sr-only");
  });

  it("rótulo do botão de menu acompanha o estado", () => {
    expect(rotuloBotaoMenu(true, 5)).toBe("Fechar menu");
    expect(rotuloBotaoMenu(false, 150)).toBe("Abrir menu, 99+ mensagens não lidas");
  });
});
