import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ substituir: vi.fn(), refresh: vi.fn(), useState: vi.fn(), useTransition: vi.fn(), useRef: vi.fn() }));
vi.mock("react", async original => ({ ...(await original<typeof import("react")>()), useState: mocks.useState, useTransition: mocks.useTransition, useRef: mocks.useRef }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/server/diario/reposicao-entrega-operacional", () => ({
  confirmarIndisponibilidadeOperacional: vi.fn(), liberarEntregaOperacional: vi.fn(), prorrogarEtapaOperacional: vi.fn(), publicarMaterialOperacional: vi.fn(), retomarIndisponibilidadeOperacional: vi.fn(), substituirAvaliadorReposicaoOperacional: mocks.substituir,
}));
vi.mock("@/server/diario/reposicao-operacoes-relatos", () => ({ descartarRelatoIndisponibilidadeEquipe: vi.fn() }));
vi.mock("./RelatarIndisponibilidadeReposicao", () => ({ RelatarIndisponibilidadeReposicao: () => null }));
import { OperacaoEntregaReposicao, type OperacaoEntrega } from "./OperacaoEntregaReposicao";

type No = { type?: unknown; props?: Record<string, unknown> };
function todos(no: unknown, tipo: string): No[] { if (Array.isArray(no)) return no.flatMap(n => todos(n, tipo)); if (!no || typeof no !== "object") return []; const n = no as No; if (typeof n.type === "function") return todos((n.type as (p: Record<string, unknown>) => unknown)(n.props ?? {}), tipo); const filhos = n.props?.children; return [...(n.type === tipo ? [n] : []), ...todos(Array.isArray(filhos) ? filhos : [filhos], tipo)]; }
const operacao: OperacaoEntrega = { reposicaoId: "repo", matriculaStatus: "ATIVA", fuso: "UTC", material: null, etapa: { correcaoId: null, prazoAte: null, prazoInicialAte: null }, liberacao: { podeLiberar: false, expiraEm: null }, indisponibilidade: null, relatosAbertos: [], avaliador: { professorId: "prof-a", nome: "Professor A", inicio: "2026-09-17T00:00:00.000Z", motivo: "Designação anterior" }, avaliadoresDisponiveis: [{ id: "prof-a", nome: "Professor A" }, { id: "prof-b", nome: "Professor B" }] };

function preparar() {
  mocks.useState.mockReturnValue(["", vi.fn()]);
  mocks.useTransition.mockReturnValue([false, (callback: () => void) => callback()]);
  mocks.useRef.mockReturnValueOnce({ current: "q40-chave-estável" }).mockReturnValueOnce({ current: false }).mockReturnValueOnce({ current: null });
  vi.stubGlobal("crypto", { randomUUID: () => "q40-chave-estável" });
}
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("envia a troca escolhida, conserva a chave no retry e mostra erro de capacidade", async () => {
  preparar();
  let professor = "prof-b";
  vi.stubGlobal("FormData", class { get(nome: string) { return ({ professorId: professor, motivo: "Substituição necessária para concluir a avaliação" } as Record<string, string>)[nome] ?? null; } });
  mocks.substituir.mockResolvedValueOnce({ ok: false, erro: "Você não tem permissão para esta ação." }).mockResolvedValueOnce({ ok: true });
  const formulario = todos(OperacaoEntregaReposicao({ operacao }), "form")[0].props!;
  await (formulario.onSubmit as (evento: { preventDefault(): void; currentTarget: object }) => void)({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve();
  professor = "prof-b";
  await (formulario.onSubmit as (evento: { preventDefault(): void; currentTarget: object }) => void)({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve();
  expect(mocks.substituir).toHaveBeenNthCalledWith(1, { reposicaoId: "repo", professorId: "prof-b", motivo: "Substituição necessária para concluir a avaliação", chaveIdempotencia: "q40-chave-estável" });
  expect(mocks.substituir).toHaveBeenNthCalledWith(2, expect.objectContaining({ professorId: "prof-b", chaveIdempotencia: "q40-chave-estável" }));
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});

it("ignora submissão concorrente enquanto a substituição está pendente", async () => {
  preparar();
  vi.stubGlobal("FormData", class { get(nome: string) { return ({ professorId: "prof-b", motivo: "Professor B assume esta reposição gravada" } as Record<string, string>)[nome] ?? null; } });
  let concluir: ((resultado: { ok: boolean }) => void) | undefined;
  mocks.substituir.mockReturnValue(new Promise(resolve => { concluir = resolve; }));
  const formulario = todos(OperacaoEntregaReposicao({ operacao }), "form")[0].props!;
  (formulario.onSubmit as any)({ preventDefault: vi.fn(), currentTarget: {} });
  (formulario.onSubmit as any)({ preventDefault: vi.fn(), currentTarget: {} });
  expect(mocks.substituir).toHaveBeenCalledTimes(1);
  concluir?.({ ok: true }); await Promise.resolve(); await Promise.resolve();
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});

it("renova a chave após sucesso e congela a entrada para retry após erro", async () => {
  preparar();
  const uuid = vi.fn().mockReturnValue("q40-chave-nova"); vi.stubGlobal("crypto", { randomUUID: uuid });
  let professor = "prof-b";
  vi.stubGlobal("FormData", class { get(nome: string) { return ({ professorId: professor, motivo: "Troca de avaliador da reposição gravada" } as Record<string, string>)[nome] ?? null; } });
  mocks.substituir.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, erro: "Resultado incerto; repita a mesma operação." }).mockResolvedValueOnce({ ok: true });
  const formulario = todos(OperacaoEntregaReposicao({ operacao }), "form")[0].props!;
  await (formulario.onSubmit as any)({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve();
  professor = "prof-a";
  await (formulario.onSubmit as any)({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve();
  professor = "prof-b";
  await (formulario.onSubmit as any)({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve();
  expect(mocks.substituir).toHaveBeenNthCalledWith(1, expect.objectContaining({ professorId: "prof-b", chaveIdempotencia: "q40-chave-estável" }));
  expect(mocks.substituir).toHaveBeenNthCalledWith(2, expect.objectContaining({ professorId: "prof-a", chaveIdempotencia: "q40-chave-nova" }));
  expect(mocks.substituir).toHaveBeenNthCalledWith(3, expect.objectContaining({ professorId: "prof-a", chaveIdempotencia: "q40-chave-nova" }));
});
