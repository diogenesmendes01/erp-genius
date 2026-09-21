import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  preparar: vi.fn(), decidirFinanceiro: vi.fn(), decidirAdministrativo: vi.fn(), aplicar: vi.fn(),
  useState: vi.fn(), useRef: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async importOriginal => ({ ...(await importOriginal<typeof import("react")>()), useState: mocks.useState, useRef: mocks.useRef }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/server/matricula/desistencia-reconferencia-delta", () => ({
  prepararReconferenciaDeltaDesistencia: mocks.preparar,
  decidirReconferenciaDeltaDesistencia: mocks.decidirFinanceiro,
  decidirAdministrativamenteReconferenciaDeltaDesistencia: mocks.decidirAdministrativo,
  aplicarReconferenciaDeltaDesistencia: mocks.aplicar,
}));
import { PrepararReconferenciaDeltaFormulario } from "./ReconferenciaDeltaFormularios";

type No = { type?: unknown; props?: Record<string, unknown> };
function nos(no: unknown): No[] { if (Array.isArray(no)) return no.flatMap(nos); if (!no || typeof no !== "object") return []; const atual = no as No; return typeof atual.type === "function" ? [atual, ...nos((atual.type as (props: Record<string, unknown>) => unknown)(atual.props ?? {}))] : [atual, ...nos(atual.props?.children)]; }
function encontrar(no: unknown, predicado: (no: No) => boolean) { const encontrado = nos(no).find(predicado); if (!encontrado) throw new Error("Elemento não encontrado"); return encontrado; }

let motivo = "Fato posterior identificado e conferido.";
class DadosFormulario {
  get(nome: string) { return nome === "motivo" ? motivo : null; }
}
function montar(incerta = false) {
  const setters = [vi.fn(), vi.fn(), vi.fn()];
  mocks.useState.mockReset()
    .mockReturnValueOnce([false, setters[0]])
    .mockReturnValueOnce([incerta, setters[1]])
    .mockReturnValueOnce(["", setters[2]]);
  const chave = { current: "chave-delta-estavel" };
  const tentativa = { current: null as unknown };
  mocks.useRef.mockReset().mockReturnValueOnce(chave).mockReturnValueOnce(tentativa);
  return { arvore: PrepararReconferenciaDeltaFormulario({ aplicacaoBaseId: "base" }), setters, chave, tentativa };
}

afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it("congela o payload e a chave quando a tentativa fica incerta", async () => {
  vi.stubGlobal("FormData", DadosFormulario);
  vi.stubGlobal("crypto", { randomUUID: () => "chave-nova" });
  mocks.preparar.mockRejectedValueOnce(new Error("rede indisponível")).mockResolvedValueOnce({ ok: true });
  const c = montar();
  const formulario = encontrar(c.arvore, no => no.type === "form");

  (formulario.props!.onSubmit as (evento: { preventDefault(): void; currentTarget: object }) => void)({ preventDefault: vi.fn(), currentTarget: {} });
  await Promise.resolve(); await Promise.resolve();
  motivo = "Motivo alterado depois da incerteza.";
  (formulario.props!.onSubmit as (evento: { preventDefault(): void; currentTarget: object }) => void)({ preventDefault: vi.fn(), currentTarget: {} });
  await Promise.resolve(); await Promise.resolve();

  expect(mocks.preparar).toHaveBeenCalledTimes(2);
  expect(mocks.preparar).toHaveBeenNthCalledWith(1, { aplicacaoBaseId: "base", motivo: "Fato posterior identificado e conferido.", chaveIdempotencia: "chave-delta-estavel" });
  expect(mocks.preparar).toHaveBeenNthCalledWith(2, { aplicacaoBaseId: "base", motivo: "Fato posterior identificado e conferido.", chaveIdempotencia: "chave-delta-estavel" });
  expect(c.setters[1]).toHaveBeenCalledWith(true);
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});

it("bloqueia a edição e oferece reconciliação quando há tentativa incerta", () => {
  vi.stubGlobal("crypto", { randomUUID: () => "chave-nova" });
  const c = montar(true);
  expect(encontrar(c.arvore, no => no.type === "fieldset").props!.disabled).toBe(true);
  expect(encontrar(c.arvore, no => no.type === "button" && no.props?.children === "Reconciliar mesma tentativa").props!.disabled).toBe(false);
});
