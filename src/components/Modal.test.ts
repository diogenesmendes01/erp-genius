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
    expect(opcoes).toEqual({ aberto: true, aoFechar, bloquearFechamento: true, focoInicial });
    expect(opcoes.focoInicial).toBe(focoInicial);
  });

  it("sem focoInicial e sem bloqueio: os padrões", () => {
    const aoFechar = vi.fn();
    renderToStaticMarkup(createElement(Modal, { titulo: "Registrar recebimento", aoFechar }));
    expect(m.useDialogo.mock.calls[0][1]).toEqual({ aberto: true, aoFechar, bloquearFechamento: false, focoInicial: undefined });
  });
});
