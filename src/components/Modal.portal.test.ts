import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// C14 (#170): no navegador, o Modal vai para um portal no <body> e pede ao useDialogo o isolamento do fundo
// (inert). Sem DOM: o useSyncExternalStore responde "cliente" (como depois da hidratação), o createPortal
// vira um marcador que registra o destino e o useDialogo é espionado. O isolamento em si (quem fica inert e
// em que ordem o foco volta) está em src/lib/dialogo.test.ts e dialogo.interacao.test.ts.
const m = vi.hoisted(() => ({ useDialogo: vi.fn(), destinos: [] as unknown[], cliente: true }));
vi.mock("@/lib/dialogo", () => ({ useDialogo: m.useDialogo }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return { ...real, useSyncExternalStore: ((_a: unknown, cliente: () => boolean, servidor: () => boolean) => (m.cliente ? cliente() : servidor())) as typeof real.useSyncExternalStore };
});
vi.mock("react-dom", async (original) => {
  const real = await original<typeof import("react-dom")>();
  return {
    ...real,
    createPortal: (filhos: ReactNode, destino: unknown) => {
      m.destinos.push(destino);
      return createElement("portal-no-body", null, filhos);
    },
  };
});

import { Modal } from "./Modal";

const corpo = { nome: "body" };
beforeEach(() => {
  m.useDialogo.mockClear();
  m.destinos.length = 0;
  vi.stubGlobal("document", { body: corpo });
});
afterEach(() => { vi.unstubAllGlobals(); m.cliente = true; });

const desenhar = () => renderToStaticMarkup(createElement(Modal, { titulo: "Cancelar a fatura?", aoFechar: vi.fn() }, "corpo do modal"));

describe("Modal no navegador — portal e fundo inert (C14, #170)", () => {
  it("aberto depois da hidratação: desenhado num portal no document.body, com o casco completo dentro", () => {
    const h = desenhar();
    expect(m.destinos).toEqual([corpo]);
    expect(h).toMatch(/^<portal-no-body><div class="fixed inset-0 z-50[^"]*"><div role="dialog" aria-modal="true"[^>]*><h3 [^>]*>Cancelar a fatura\?<\/h3>corpo do modal<\/div><\/div><\/portal-no-body>$/);
  });

  it("pede ao useDialogo o isolamento da própria camada (a raiz do portal), não da caixa do diálogo", () => {
    desenhar();
    const [caixa, opcoes] = m.useDialogo.mock.calls[0];
    expect(opcoes.isolar).toBeDefined();
    expect(opcoes.isolar).toHaveProperty("current");
    expect(opcoes.isolar).not.toBe(caixa);
  });

  it("na hidratação (snapshot do servidor): fica no lugar e sem isolamento, como no HTML do servidor", () => {
    m.cliente = false;
    const h = desenhar();
    expect(m.destinos).toEqual([]);
    expect(h).not.toContain("portal-no-body");
    expect(m.useDialogo.mock.calls[0][1].isolar).toBeUndefined();
  });
});
