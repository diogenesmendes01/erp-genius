import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ preparar: vi.fn(), decidir: vi.fn(), refresh: vi.fn(), useState: vi.fn(), useRef: vi.fn(), useTransition: vi.fn() }));
vi.mock("react", async original => ({ ...(await original<typeof import("react")>()), useState: mocks.useState, useRef: mocks.useRef, useTransition: mocks.useTransition }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/server/financeiro/revisao-correcao-aula", () => ({ proporRevisaoFinanceiraCorrecaoAula: mocks.preparar, decidirRevisaoFinanceiraCorrecaoAula: mocks.decidir, consultarRevisoesFinanceirasCorrecaoAula: vi.fn() }));

import { RevisoesCorrecaoAula } from "./RevisoesCorrecaoAula";

type No = { type?: unknown; props?: Record<string, unknown> };
function nos(no: unknown): No[] { if (Array.isArray(no)) return no.flatMap(nos); if (!no || typeof no !== "object") return []; const atual = no as No; return typeof atual.type === "function" ? [atual, ...nos((atual.type as (props: Record<string, unknown>) => unknown)(atual.props ?? {}))] : [atual, ...nos(atual.props?.children)]; }
function encontrar(no: unknown, predicado: (no: No) => boolean) { const encontrado = nos(no).find(predicado); if (!encontrado) throw new Error("Elemento não encontrado"); return encontrado; }

class DadosFormulario { get(nome: string) { return nome === "motivo" ? "Reconferência financeira necessária." : null; } }
function montar() {
  mocks.useTransition.mockReturnValue([false, (acao: () => void) => { void acao(); }]);
  mocks.useState.mockReturnValue(["", vi.fn()]);
  mocks.useRef.mockReturnValue({ current: new Map() });
  return RevisoesCorrecaoAula({ matriculaId: "matricula", dados: { usuarioId: "fin", revisoes: [], candidatas: [{ id: "q23", encontroId: "encontro", versao: 1, encontro: { id: "encontro", inicio: new Date("2026-01-10T15:00:00Z"), fim: new Date("2026-01-10T16:15:00Z"), fusoOrigem: "America/Sao_Paulo" }, podePreparar: true, preparoBloqueadoPor: null }] } as never });
}

afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it("gera nova chave depois de preparar com sucesso, sem reaproveitar o replay anterior", async () => {
  vi.stubGlobal("FormData", DadosFormulario); vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValueOnce("chave-primeira").mockReturnValueOnce("chave-segunda") });
  mocks.preparar.mockResolvedValue({ ok: true });
  const formulario = encontrar(montar(), no => no.type === "form");
  const enviar = formulario.props!.onSubmit as (evento: { preventDefault(): void; currentTarget: object }) => void;

  enviar({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve(); await Promise.resolve();
  enviar({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve(); await Promise.resolve();

  expect(mocks.preparar).toHaveBeenNthCalledWith(1, { propostaCorrecaoAulaId: "q23", motivo: "Reconferência financeira necessária.", chaveIdempotencia: "chave-primeira" });
  expect(mocks.preparar).toHaveBeenNthCalledWith(2, { propostaCorrecaoAulaId: "q23", motivo: "Reconferência financeira necessária.", chaveIdempotencia: "chave-segunda" });
  expect(mocks.refresh).toHaveBeenCalledTimes(2);
});
