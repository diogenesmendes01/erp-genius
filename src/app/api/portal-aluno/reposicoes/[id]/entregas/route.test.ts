import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ registrar: vi.fn(), ler: vi.fn() }));
vi.mock("@/server/portal-aluno/entregas-reposicao", () => ({ registrarEntregaReposicaoPortalAluno: mocks.registrar }));
vi.mock("@/server/portal-aluno/http", () => ({ lerJsonPortalAluno: mocks.ler }));
import { POST } from "./route";

const request = (origem = "https://escola.example") => new Request("https://escola.example/api/portal-aluno/reposicoes/nao-confiar/entregas", {
  method: "POST", headers: { origin: origem, "content-type": "application/json" }, body: "{}",
});

beforeEach(() => { vi.resetAllMocks(); });

it("recusa origem externa sem tentar registrar entrega", async () => {
  const resposta = await POST(request("https://externa.example"), { params: Promise.resolve({ id: "reposicao-propria" }) });
  expect(resposta.status).toBe(403); expect(resposta.headers.get("cache-control")).toBe("no-store");
  expect(mocks.ler).not.toHaveBeenCalled(); expect(mocks.registrar).not.toHaveBeenCalled();
});

it("usa somente o identificador da rota, jamais reposicaoId enviado pelo navegador", async () => {
  mocks.ler.mockResolvedValue({ reposicaoId: "outra-reposicao", resumo: "Resumo suficiente", atividade: "Atividade suficiente", evidencia: "Evidência suficiente" });
  mocks.registrar.mockResolvedValue({ id: "entrega-1" });
  const resposta = await POST(request(), { params: Promise.resolve({ id: "reposicao-propria" }) });
  expect(resposta.status).toBe(200); expect(mocks.registrar).toHaveBeenCalledWith(expect.objectContaining({ reposicaoId: "reposicao-propria" }));
});
