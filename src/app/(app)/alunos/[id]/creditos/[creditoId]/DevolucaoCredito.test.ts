import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ propor: vi.fn(), router: { refresh: vi.fn() }, useState: vi.fn(), useTransition: vi.fn(), useRef: vi.fn() }));
vi.mock("react", async original => ({ ...(await original<typeof import("react")>()), useState: mocks.useState, useTransition: mocks.useTransition, useRef: mocks.useRef }));
vi.mock("@/server/financeiro/devolucao-credito", () => ({ proporDevolucaoCredito: mocks.propor, decidirDevolucaoCredito: vi.fn(), registrarExecucaoDevolucaoCredito: vi.fn(), conciliarDevolucaoCredito: vi.fn(), cancelarDevolucaoCredito: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
import { DevolucaoCredito } from "./DevolucaoCredito";

type No = { type?: unknown; props?: Record<string, unknown> };
function encontrar(no: unknown, tipo: string): No | undefined { if (Array.isArray(no)) return no.map(n => encontrar(n, tipo)).find(Boolean); if (no && typeof no === "object") { const n = no as No; if (n.type === tipo) return n; const filhos = n.props?.children; return encontrar(Array.isArray(filhos) ? filhos : [filhos], tipo); } }
const dados = { creditoId: "c", valorCredito: "200.00", reservaDevolucao: "0.00", devolvido: "0.00", moeda: "CRC", devolucoes: [], cobrancas: [], propostas: [], matriculaId: "m", aplicacaoDisponivel: true as const } as any;
afterEach(() => vi.unstubAllGlobals());
it("submete proposta pelo callback real e refresca apenas após sucesso", async () => {
  mocks.useState.mockReturnValue(["", vi.fn()]); mocks.useTransition.mockReturnValue([false, (cb: () => void) => cb()]); mocks.useRef.mockReturnValue({ current: "" });
  mocks.propor.mockResolvedValue({ ok: true, dado: { id: "p" } }); vi.stubGlobal("crypto", { randomUUID: () => "chave-ui-devolucao" });
  vi.stubGlobal("FormData", class { get(nome: string) { return ({ valor: "100.00", pedidoAluno: "Pedido do aluno válido", evidenciaPedido: "Evidência do pedido válida", destino: "Destino bancário conferido", motivo: "Motivo financeiro válido" } as Record<string, string>)[nome] ?? null; } });
  const form = encontrar(DevolucaoCredito({ dados }), "form")!.props!;
  await (form.onSubmit as (e: { preventDefault(): void; currentTarget: object }) => void)({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve();
  expect(mocks.propor).toHaveBeenCalledWith(expect.objectContaining({ creditoId: "c", chaveIdempotencia: "chave-ui-devolucao", destino: "Destino bancário conferido" })); expect(mocks.router.refresh).toHaveBeenCalled();
});
