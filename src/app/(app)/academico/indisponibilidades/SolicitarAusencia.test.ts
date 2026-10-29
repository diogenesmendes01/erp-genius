// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

function botaoDoRotulo(rotulo: string) {
  const label = screen.getByText(rotulo).closest("label");
  const botao = label?.querySelector("button");
  if (!(botao instanceof HTMLButtonElement)) throw new Error(`gatilho de ${rotulo} ausente`);
  return botao;
}

function resetar(raiz: ParentNode) {
  const form = raiz.querySelector("form");
  if (!(form instanceof HTMLFormElement)) throw new Error("form ausente");
  act(() => { form.reset(); });
}

async function escolherDiaHora(user: ReturnType<typeof userEvent.setup>, gatilho: HTMLElement, dia: RegExp, hora: string, minuto: string) {
  await user.click(gatilho);
  await user.click(await screen.findByRole("button", { name: dia }));
  await user.click(screen.getByRole("combobox", { name: "Hora" }));
  await user.click(await screen.findByRole("option", { name: hora }));
  await user.click(screen.getByRole("combobox", { name: "Minuto" }));
  await user.click(await screen.findByRole("option", { name: minuto }));
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("combobox", { name: "Hora" })).toBeNull());
}

describe("SolicitarAusencia — reset do DateTimePicker", () => {
  it("WARN-526-03: Início e Fim ficam vazios depois do reset", async () => {
    const user = userEvent.setup();
    const { container } = render(createElement(SolicitarAusencia, { professores: [{ id: "p", nome: "Ana" }], fusoInicial: "America/Sao_Paulo" }));
    await escolherDiaHora(user, botaoDoRotulo("Início da indisponibilidade"), /15 de outubro de 2026/, "09", "15");
    await escolherDiaHora(user, botaoDoRotulo("Fim da indisponibilidade"), /15 de outubro de 2026/, "11", "45");
    const inicio = inputNome("inicio");
    const fim = inputNome("fim");
    expect(inicio.value).toBe("2026-10-15T09:15");
    expect(fim.value).toBe("2026-10-15T11:45");
    expect(gatilhoDo(inicio).textContent).toContain("15/10/2026, 09:15");
    expect(gatilhoDo(fim).textContent).toContain("15/10/2026, 11:45");

    resetar(container);
    expect(inicio.value).toBe("");
    expect(fim.value).toBe("");
    expect(gatilhoDo(inicio).textContent).toContain(VAZIO);
    expect(gatilhoDo(fim).textContent).toContain(VAZIO);
  });

  it("WARN-526-03: picker com defaultValue volta para o default no reset", async () => {
    const user = userEvent.setup();
    const { container } = render(createElement("form", null,
      createElement(DateTimePicker, { name: "quando", defaultValue: "2026-12-01T10:00", "aria-label": "Quando" }),
    ));
    await user.click(screen.getByRole("button", { name: "Quando" }));
    await user.click(await screen.findByRole("button", { name: /15 de dezembro de 2026/ }));
    const quando = inputNome("quando");
    expect(quando.value).toBe("2026-12-15T10:00");
    expect(screen.getByRole("button", { name: "Quando" }).textContent).toContain("15/12/2026, 10:00");

    resetar(container);
    expect(quando.value).toBe("2026-12-01T10:00");
    expect(screen.getByRole("button", { name: "Quando" }).textContent).toContain("01/12/2026, 10:00");
  });

  it("BLOCK-528-01: a ref callback do pai não recebe null a cada re-render", () => {
    const chamadas: Array<HTMLInputElement | null> = [];
    const ref = (el: HTMLInputElement | null) => { chamadas.push(el); };
    const { rerender } = render(createElement("form", null,
      createElement(DateTimePicker, { ref, name: "quando", "aria-label": "Quando" }),
    ));
    expect(chamadas.map((el) => el?.getAttribute("name") ?? null)).toEqual(["quando"]);
    rerender(createElement("form", null,
      createElement(DateTimePicker, { ref, name: "quando", "aria-label": "Quando", placeholder: "outra dica" }),
    ));
    expect(chamadas.map((el) => el?.getAttribute("name") ?? null)).toEqual(["quando"]);
  });

  it("BLOCK-528-02: o reset usa o defaultValue do último render", () => {
    const { container, rerender } = render(createElement("form", null,
      createElement(DateTimePicker, { name: "quando", defaultValue: "2026-12-01T10:00", "aria-label": "Quando" }),
    ));
    expect(inputNome("quando").value).toBe("2026-12-01T10:00");
    rerender(createElement("form", null,
      createElement(DateTimePicker, { name: "quando", defaultValue: "2026-12-15T18:45", "aria-label": "Quando" }),
    ));
    resetar(container);
    expect(inputNome("quando").value).toBe("2026-12-15T18:45");
    expect(screen.getByRole("button", { name: "Quando" }).textContent).toContain("15/12/2026, 18:45");
  });
});
