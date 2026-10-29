// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));
const salvar = vi.hoisted(() => vi.fn());
vi.mock("@/server/avaliacoes/lancamentos", () => ({
  salvarLancamentoAvaliacaoLocal: salvar,
  oficializarLancamentoAvaliacao: vi.fn(),
}));

import { LancarNotas } from "./Formularios";

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

afterEach(() => { cleanup(); salvar.mockReset(); });

const props = {
  alocacaoId: "alocacao",
  codigoAvaliacao: "final",
  versaoEsperada: 1,
  habilidades: ["FALA" as const],
  escala: { minimo: "0", maximo: "10" },
  anterior: { realizadaEm: "2026-10-01T02:30:00.000", instante: "2026-10-01T02:30:00.000Z", notas: [] },
  fuso: "UTC",
  realizadores: [],
  registradorId: "professor",
};

describe("LancarNotas — CampoInstante com milissegundos", () => {
  it("required com step 0.001 envia YYYY-MM-DDTHH:mm:ss.SSS", async () => {
    salvar.mockResolvedValue({ ok: true });
    render(createElement(LancarNotas, props));
    const campo = document.querySelector('input[name="realizadaEm"]') as HTMLInputElement;
    const espelho = document.querySelector('input[aria-hidden="true"]') as HTMLInputElement;
    expect(campo.value).toBe("2026-10-01T02:30:00.000");
    expect(campo.getAttribute("step")).toBe("0.001");
    expect(campo.required).toBe(true);
    expect(espelho.validationMessage).toBe("");
    expect(espelho.checkValidity()).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Encaminhamento" }));
    await user.click(await screen.findByRole("option", { name: "Salvar rascunho" }));
    await user.click(screen.getByRole("button", { name: "Registrar versão" }));
    await waitFor(() => expect(salvar).toHaveBeenCalledOnce());
    expect(salvar.mock.calls[0][0]).toMatchObject({
      realizadaLocal: "2026-10-01T02:30:00.000",
      fuso: "UTC",
      submetida: false,
    });
    expect(screen.queryByText("Informe data e hora.")).toBeNull();
  });
});
