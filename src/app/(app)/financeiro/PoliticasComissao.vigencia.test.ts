// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const { publicar } = vi.hoisted(() => ({ publicar: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/server/financeiro/politica-comissao-local", () => ({ publicarPoliticaComissaoLocal: publicar }));

import { PoliticasComissao } from "./PoliticasComissao";

const requestSubmitOriginal = HTMLFormElement.prototype.requestSubmit;
beforeAll(() => {
  HTMLFormElement.prototype.requestSubmit = function requestSubmit() {
    this.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  };
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

afterAll(() => { HTMLFormElement.prototype.requestSubmit = requestSubmitOriginal; });
afterEach(() => { cleanup(); publicar.mockReset(); });

const dados = {
  paises: [{ id: "cr", nome: "Costa Rica", moedaLocal: "CRC" }],
  produtos: [{ id: "produto", nome: "Mensal" }],
  politicas: [],
} as never;

function botaoDoRotulo(rotulo: string) {
  const label = screen.getByText(rotulo).closest("label");
  const botao = label?.querySelector("button");
  if (!(botao instanceof HTMLButtonElement)) throw new Error(`gatilho de ${rotulo} ausente`);
  return botao;
}

function inputNome(nome: string) {
  const input = document.querySelector(`input[name="${nome}"]`);
  if (!(input instanceof HTMLInputElement)) throw new Error(`input ${nome} ausente`);
  return input;
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

async function escolherOpcao(user: ReturnType<typeof userEvent.setup>, rotulo: string, opcao: string) {
  await user.click(botaoDoRotulo(rotulo));
  await user.click(await screen.findByRole("option", { name: opcao }));
}

describe("PoliticasComissao — vigência e o resultado da action", () => {
  it("R2: mantém a Vigência quando a action erra e só zera no sucesso", async () => {
    const user = userEvent.setup();
    publicar.mockResolvedValueOnce({ ok: false, erro: "Regra recusada." });
    render(createElement(PoliticasComissao, { dados, fusoEscola: "America/Sao_Paulo" }));
    await escolherOpcao(user, "País", "Costa Rica · CRC");
    await escolherOpcao(user, "Oferta", "Mensal");
    await user.type(screen.getByRole("spinbutton"), "10");
    await escolherDiaHora(user, botaoDoRotulo("Vigência (vazio = agora)"), /15 de outubro de 2026/, "09", "15");
    const vigencia = inputNome("vigencia");
    expect(vigencia.value).toBe("2026-10-15T09:15");

    await user.click(screen.getByRole("button", { name: "Publicar nova versão" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Regra recusada.");
    expect(publicar).toHaveBeenCalledTimes(1);
    expect(vigencia.value).toBe("2026-10-15T09:15");
    expect(botaoDoRotulo("Vigência (vazio = agora)").textContent).toContain("15/10/2026, 09:15");

    publicar.mockResolvedValueOnce({ ok: true, dado: { id: "nova" } });
    await user.click(screen.getByRole("button", { name: "Publicar nova versão" }));
    await waitFor(() => expect(publicar).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(vigencia.value).toBe(""));
    expect(botaoDoRotulo("Vigência (vazio = agora)").textContent).toContain("dd/mm/aaaa, hh:mm");
  });
});
