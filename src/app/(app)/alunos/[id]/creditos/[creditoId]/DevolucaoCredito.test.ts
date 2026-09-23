import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ propor: vi.fn(), executar: vi.fn(), cancelar: vi.fn(), conciliar: vi.fn(), router: { refresh: vi.fn() }, useState: vi.fn(), useTransition: vi.fn(), useRef: vi.fn() }));
vi.mock("react", async original => ({ ...(await original<typeof import("react")>()), useState: mocks.useState, useTransition: mocks.useTransition, useRef: mocks.useRef }));
vi.mock("@/server/financeiro/devolucao-credito", () => ({ proporDevolucaoCredito: mocks.propor, decidirDevolucaoCredito: vi.fn(), registrarExecucaoDevolucaoCredito: mocks.executar, conciliarDevolucaoCredito: mocks.conciliar, cancelarDevolucaoCredito: mocks.cancelar }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
import { DevolucaoCredito } from "./DevolucaoCredito";

type No = { type?: unknown; props?: Record<string, unknown> };
function todos(no: unknown, tipo: string): No[] { if (Array.isArray(no)) return no.flatMap(n => todos(n, tipo)); if (!no || typeof no !== "object") return []; const n = no as No; if (typeof n.type === "function") return todos((n.type as (p: Record<string, unknown>) => unknown)(n.props ?? {}), tipo); const filhos = n.props?.children; return [...(n.type === tipo ? [n] : []), ...todos(Array.isArray(filhos) ? filhos : [filhos], tipo)]; }
function encontrar(no: unknown, tipo: string) { return todos(no, tipo)[0]; }
const dados = { creditoId: "c", valorCredito: "200.00", reservaDevolucao: "0.00", devolvido: "0.00", moeda: "CRC", devolucoes: [], cobrancas: [], propostas: [], matriculaId: "m", aplicacaoDisponivel: true as const } as any;
afterEach(() => vi.unstubAllGlobals());
it("submete proposta pelo callback real e refresca apenas após sucesso", async () => {
  // Dois useState na ordem em que o componente chama: erro, depois valor (CampoMoeda) —
  // "100,00" com vírgula pra confirmar que parseMoeda entende o formato que o campo produz.
  mocks.useState.mockReturnValueOnce(["", vi.fn()]).mockReturnValueOnce(["100,00", vi.fn()]);
  mocks.useTransition.mockReturnValue([false, (cb: () => void) => cb()]); mocks.useRef.mockReturnValue({ current: "" });
  mocks.propor.mockResolvedValue({ ok: true, dado: { id: "p" } }); vi.stubGlobal("crypto", { randomUUID: () => "chave-ui-devolucao" });
  vi.stubGlobal("FormData", class { get(nome: string) { return ({ pedidoAluno: "Pedido do aluno válido", evidenciaPedido: "Evidência do pedido válida", destino: "Destino bancário conferido", motivo: "Motivo financeiro válido" } as Record<string, string>)[nome] ?? null; } });
  const form = encontrar(DevolucaoCredito({ dados }), "form")!.props!;
  await (form.onSubmit as (e: { preventDefault(): void; currentTarget: object }) => void)({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve();
  expect(mocks.propor).toHaveBeenCalledWith(expect.objectContaining({ creditoId: "c", valor: "100.00", chaveIdempotencia: "chave-ui-devolucao", destino: "Destino bancário conferido" })); expect(mocks.router.refresh).toHaveBeenCalled();
});
it("não submete quando o valor não é interpretável (parseMoeda rejeita)", async () => {
  mocks.propor.mockClear();
  mocks.useState.mockReturnValueOnce(["", vi.fn()]).mockReturnValueOnce(["1.234", vi.fn()]);
  mocks.useTransition.mockReturnValue([false, (cb: () => void) => cb()]); mocks.useRef.mockReturnValue({ current: "" });
  vi.stubGlobal("crypto", { randomUUID: () => "chave-rejeitada" });
  vi.stubGlobal("FormData", class { get(nome: string) { return ({ pedidoAluno: "Pedido do aluno válido", evidenciaPedido: "Evidência do pedido válida", destino: "Destino bancário conferido", motivo: "Motivo financeiro válido" } as Record<string, string>)[nome] ?? null; } });
  const form = encontrar(DevolucaoCredito({ dados }), "form")!.props!;
  await (form.onSubmit as (e: { preventDefault(): void; currentTarget: object }) => void)({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve();
  expect(mocks.propor).not.toHaveBeenCalled();
});
it("aciona execução, cancelamento e conciliação pelos callbacks", async () => {
  const base = { id: "p", versao: 1, valor: "100", pedidoAluno: "pedido", evidenciaPedido: "evidencia", destino: "destino", criadoEm: "x", podeExecutar: true, podeCancelar: true, podeConciliar: false, decisao: { aprovada: true, motivo: "ok", reserva: { id: "r", estado: "AGUARDANDO_EXECUCAO", referenciaExterna: null, evidenciaExecucao: null, conciliacoes: [], cancelamento: null } } };
  const setErro = vi.fn(); mocks.useState.mockReturnValue(["", setErro]); mocks.useTransition.mockReturnValue([false, (cb: () => void) => cb()]); mocks.useRef.mockReturnValueOnce({ current: "" }).mockReturnValueOnce({ current: new Map() }); mocks.executar.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ ok: true }); mocks.cancelar.mockResolvedValue({ ok: true }); const uuid = vi.fn().mockReturnValueOnce("chave-1").mockReturnValueOnce("chave-2"); vi.stubGlobal("crypto", { randomUUID: uuid }); vi.stubGlobal("FormData", class { get(n: string) { return ({ resultado: "INCERTO", referencia: "ref", evidencia: "evidencia válida", motivo: "motivo válido" } as Record<string, string>)[n] ?? null; } });
  const forms = todos(DevolucaoCredito({ dados: { ...dados, devolucoes: [base] } }), "form"); await (forms[1].props!.onSubmit as any)({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve(); expect(mocks.cancelar).toHaveBeenCalled(); mocks.router.refresh.mockClear(); await (forms[2].props!.onSubmit as any)({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve(); expect(mocks.router.refresh).not.toHaveBeenCalled(); await (forms[2].props!.onSubmit as any)({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve(); expect(mocks.executar).toHaveBeenNthCalledWith(1, expect.objectContaining({ chaveIdempotencia: "chave-1" })); expect(mocks.executar).toHaveBeenNthCalledWith(2, expect.objectContaining({ chaveIdempotencia: "chave-1" })); expect(uuid).toHaveBeenCalledTimes(1); expect(setErro).toHaveBeenCalled();
  const incerto = { ...base, podeExecutar: false, podeCancelar: false, podeConciliar: true, decisao: { ...base.decisao, reserva: { ...base.decisao.reserva, estado: "INCERTO" } } }; mocks.useRef.mockReset().mockReturnValue({ current: "" }); await (todos(DevolucaoCredito({ dados: { ...dados, devolucoes: [incerto] } }), "form")[1].props!.onSubmit as any)({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve(); expect(mocks.conciliar).toHaveBeenCalledWith({ reservaId: "r", confirmouSaida: false, evidenciaConciliacao: "evidencia válida" });
});
