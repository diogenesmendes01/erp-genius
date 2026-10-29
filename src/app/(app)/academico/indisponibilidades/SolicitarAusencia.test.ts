// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/server/agenda/indisponibilidade", () => ({ solicitarIndisponibilidadeLocal: vi.fn() }));

import { SolicitarAusencia } from "./SolicitarAusencia";
import { DateTimePicker } from "@/components/ui/date-time-picker";

beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  }
  for (const proto of [Element.prototype, HTMLElement.prototype]) {
    const alvo = proto as Element & { scrollIntoView?: () => void; hasPointerCapture?: () => boolean; setPointerCapture?: () => void; releasePointerCapture?: () => void };
    alvo.scrollIntoView ??= () => {};
    alvo.hasPointerCapture ??= () => false;
    alvo.setPointerCapture ??= () => {};
    alvo.releasePointerCapture ??= () => {};
  }
});

afterEach(() => { cleanup(); });

const VAZIO = "dd/mm/aaaa, hh:mm";

function inputNome(nome: string) {
  const input = document.querySelector(`input[name="${nome}"]`);
  if (!(input instanceof HTMLInputElement)) throw new Error(`input ${nome} ausente`);
  return input;
}

function gatilhoDo(input: HTMLInputElement) {
  const botao = input.parentElement?.querySelector("button");
  if (!(botao instanceof HTMLButtonElement)) throw new Error("gatilho ausente");
  return botao;
}

function preencher(input: HTMLInputElement, valor: string) {
  const chave = Object.keys(input).find((k) => k.startsWith("__reactProps"));
  const props = chave ? (input as unknown as Record<string, { onChange?: (evento: { target: { value: string } }) => void }>)[chave] : undefined;
  if (!props?.onChange) throw new Error("onChange ausente");
  act(() => { props.onChange?.({ target: { value: valor } }); });
}

function resetar(raiz: ParentNode) {
  const form = raiz.querySelector("form");
  if (!(form instanceof HTMLFormElement)) throw new Error("form ausente");
  act(() => { form.reset(); });
}

describe("SolicitarAusencia — reset do DateTimePicker", () => {
  it("WARN-526-03: Início e Fim ficam vazios depois do reset", () => {
    const { container } = render(createElement(SolicitarAusencia, { professores: [{ id: "p", nome: "Ana" }], fusoInicial: "America/Sao_Paulo" }));
    const inicio = inputNome("inicio");
    const fim = inputNome("fim");
    preencher(inicio, "2026-11-03T09:15");
    preencher(fim, "2026-11-03T11:45");
    expect(inicio.value).toBe("2026-11-03T09:15");
    expect(fim.value).toBe("2026-11-03T11:45");
    expect(gatilhoDo(inicio).textContent).toContain("03/11/2026, 09:15");
    expect(gatilhoDo(fim).textContent).toContain("03/11/2026, 11:45");

    resetar(container);
    expect(inicio.value).toBe("");
    expect(fim.value).toBe("");
    expect(gatilhoDo(inicio).textContent).toContain(VAZIO);
    expect(gatilhoDo(fim).textContent).toContain(VAZIO);
  });

  it("WARN-526-03: picker com defaultValue volta para o default no reset", () => {
    const { container } = render(createElement("form", null,
      createElement(DateTimePicker, { name: "quando", defaultValue: "2026-12-01T10:00", "aria-label": "Quando" }),
    ));
    const quando = inputNome("quando");
    preencher(quando, "2026-12-02T11:30");
    expect(quando.value).toBe("2026-12-02T11:30");
    expect(screen.getByRole("button", { name: "Quando" }).textContent).toContain("02/12/2026, 11:30");

    resetar(container);
    expect(quando.value).toBe("2026-12-01T10:00");
    expect(screen.getByRole("button", { name: "Quando" }).textContent).toContain("01/12/2026, 10:00");
  });
});
