import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ relatar: vi.fn(), ler: vi.fn() }));
vi.mock("@/server/portal-aluno/entregas-reposicao", () => ({ relatarIndisponibilidadeMaterialPortalAluno: mocks.relatar }));
vi.mock("@/server/portal-aluno/http", () => ({ lerJsonPortalAluno: mocks.ler }));
import { POST } from "./route";

const request = (origem = "https://escola.example") => new Request("https://escola.example/api/portal-aluno/reposicoes/id-nao-confiar/indisponibilidades", {
  method: "POST", headers: { origin: origem, "content-type": "application/json" }, body: "{}",
});

beforeEach(() => { vi.resetAllMocks(); });

it("recusa origem externa antes de ler o corpo ou tocar no relato", async () => {
  const resposta = await POST(request("https://externa.example"), { params: Promise.resolve({ id: "reposicao-propria" }) });
  expect(resposta.status).toBe(403);
  expect(resposta.headers.get("cache-control")).toBe("no-store");
  expect(mocks.ler).not.toHaveBeenCalled();
  expect(mocks.relatar).not.toHaveBeenCalled();
});

it("usa a reposição da rota e não aceita a fornecida no corpo", async () => {
  mocks.ler.mockResolvedValue({ reposicaoId: "outra-matricula", descricao: "A gravação não inicia depois de várias tentativas." });
  mocks.relatar.mockResolvedValue({ id: "relato-1" });

  const resposta = await POST(request(), { params: Promise.resolve({ id: "reposicao-propria" }) });

  expect(resposta.status).toBe(200);
  expect(resposta.headers.get("cache-control")).toBe("no-store");
  expect(mocks.relatar).toHaveBeenCalledWith(expect.objectContaining({
    reposicaoId: "reposicao-propria",
    descricao: "A gravação não inicia depois de várias tentativas.",
  }));
});

it("devolve erro genérico e sem cache quando o corpo limitado ou a autorização falham", async () => {
  mocks.ler.mockRejectedValue(new Error("Corpo excede o limite permitido."));
  const resposta = await POST(request(), { params: Promise.resolve({ id: "reposicao-propria" }) });

  expect(resposta.status).toBe(422);
  expect(resposta.headers.get("cache-control")).toBe("no-store");
  await expect(resposta.json()).resolves.toEqual({ erro: "Não foi possível registrar o relato de indisponibilidade." });
  expect(mocks.relatar).not.toHaveBeenCalled();
});
