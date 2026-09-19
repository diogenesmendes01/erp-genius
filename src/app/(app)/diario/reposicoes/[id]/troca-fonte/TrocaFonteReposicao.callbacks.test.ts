import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ propor: vi.fn(), refresh: vi.fn(), useState: vi.fn(), useTransition: vi.fn(), useRef: vi.fn() }));
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), useState: mocks.useState, useTransition: mocks.useTransition, useRef: mocks.useRef }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/server/gravacoes/troca-fonte-reposicao", () => ({ proporTrocaFonteReposicaoGravacao: mocks.propor, decidirTrocaFonteReposicaoGravacao: vi.fn() }));
import { TrocaFonteReposicao } from "./TrocaFonteReposicao";

type No = { type?: unknown; props?: Record<string, unknown> };
function acharFormulario(no: unknown): No | undefined {
  if (Array.isArray(no)) return no.map(acharFormulario).find(Boolean);
  if (!no || typeof no !== "object") return undefined;
  const atual = no as No;
  if (atual.type === "form") return atual;
  const filhos = atual.props?.children;
  return acharFormulario(Array.isArray(filhos) ? filhos : [filhos]);
}

afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

it("refaz a consulta após a proposta confirmada, mantendo o ID contextual fora do formulário", async () => {
  mocks.useState.mockReturnValue(["", vi.fn()]);
  mocks.useTransition.mockReturnValue([false, (acao: () => void) => acao()]);
  mocks.useRef.mockReturnValue({ current: "chave-estavel" });
  mocks.propor.mockResolvedValue({ ok: true, dado: { id: "proposta" } });
  vi.stubGlobal("FormData", class { get(nome: string) { return nome === "motivo" ? "A fonte corrigida deve ser adotada." : null; } });
  const formulario = acharFormulario(TrocaFonteReposicao({
    contexto: { reposicaoId: "repo-contextual", materialId: "material", matriculaId: "matricula", fonteMaterialAtual: { versao: 1, revisao: "m1" }, fontePublicacaoAtual: { versao: 2, revisao: "p2" }, materialDisponivel: true, disponibilizacaoId: null, jaAdotaPublicacaoAtual: false }, propostas: [], fusoExibicao: "America/Costa_Rica",
  }));
  await (formulario!.props!.onSubmit as (evento: { preventDefault(): void; currentTarget: object }) => void)({ preventDefault: vi.fn(), currentTarget: {} });
  await Promise.resolve();
  expect(mocks.propor).toHaveBeenCalledWith({ reposicaoId: "repo-contextual", motivo: "A fonte corrigida deve ser adotada.", chaveIdempotencia: "chave-estavel" });
  expect(mocks.refresh).toHaveBeenCalledOnce();
});
