import { createElement, type RefObject } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// O Modal repassa ao useDialogo o que o diálogo precisa (R1 da #154, B3/O3): sem `focoInicial`, o
// ConfirmarAcao abriria com o foco no primeiro botão em vez do "Voltar". O comportamento do gancho em si
// está em src/lib/dialogo.interacao.test.ts.
const m = vi.hoisted(() => ({ useDialogo: vi.fn() }));
vi.mock("@/lib/dialogo", () => ({ useDialogo: m.useDialogo }));

import { Modal } from "./Modal";

beforeEach(() => m.useDialogo.mockClear());

describe("Modal \u2192 useDialogo", () => {
  it("repassa aberto, aoFechar, bloquearFechamento e focoInicial", () => {
    const aoFechar = vi.fn();
    const focoInicial: RefObject<HTMLElement | null> = { current: null };
    renderToStaticMarkup(createElement(Modal, { titulo: "Cancelar a fatura?", aoFechar, bloquearFechamento: true, focoInicial }));
    expect(m.useDialogo).toHaveBeenCalledTimes(1);
    const [ref, opcoes] = m.useDialogo.mock.calls[0];
    expect(ref).toHaveProperty("current");
    expect(opcoes).toEqual({ aberto: true, aoFechar, bloquearFechamento: true, focoInicial, isolar: undefined });
    expect(opcoes.focoInicial).toBe(focoInicial);
  });

  it("sem focoInicial e sem bloqueio: os padrões", () => {
    const aoFechar = vi.fn();
    renderToStaticMarkup(createElement(Modal, { titulo: "Registrar recebimento", aoFechar }));
    expect(m.useDialogo.mock.calls[0][1]).toEqual({ aberto: true, aoFechar, bloquearFechamento: false, focoInicial: undefined, isolar: undefined });
  });
});

describe("Modal no HTML do servidor (C14, #170)", () => {
  it("sem document, sai no lugar (sem portal) e não pede isolamento do fundo — o HTML estático continua igual", () => {
    const h = renderToStaticMarkup(createElement(Modal, { titulo: "Registrar recebimento", aoFechar: vi.fn() }, "corpo"));
    expect(h).toMatch(/^<div class="fixed inset-0 z-50[^"]*"><div role="dialog" aria-modal="true"/);
    expect(h).toContain("corpo");
    expect(m.useDialogo.mock.calls[0][1].isolar).toBeUndefined();
  });
});

describe("Modal → camada elevada (DS)", () => {
  const html = (props: Record<string, unknown> = {}, filhos?: string) =>
    renderToStaticMarkup(createElement(Modal, { titulo: "Cancelar a fatura?", aoFechar: vi.fn(), ...props }, filhos));

  it("modal limita largura e altura", () => {
    const h = html();
    expect(h).toContain("max-w-[calc(100vw-24px)]");
    expect(h).toContain("max-h-[90dvh]");
    expect(h).toContain("rounded-dialog");
    expect(h).toContain("shadow-dialog");
    expect(h).toContain("bg-surface-raised");
    expect(h).toContain("bg-black/60");
    expect(h).toContain("sm:w-[460px]");
    expect(h).toContain("text-xl font-medium");
  });

  it("variante larga usa 640px", () => {
    const h = html({ larga: true });
    expect(h).toContain("sm:w-[640px]");
    expect(h).not.toContain("sm:w-[460px]");
  });
});
