import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ reposicao: vi.fn() }));
vi.mock("@/server/portal-aluno/reposicoes", () => ({
  exigirReposicaoDoPortalAluno: mocks.reposicao,
  consultarEntregaGravacaoPortalAluno: vi.fn(),
  estadoEntregaPortalAluno: vi.fn(),
}));
vi.mock("@/server/gravacoes/autorizacao", () => ({ autorizarReproducaoGravacao: vi.fn() }));
vi.mock("@/server/portal-aluno/preferencia-fuso", () => ({ consultarPreferenciaFusoPortalAluno: vi.fn() }));
import Page from "./page";

it("redireciona para /portal-aluno/entrar quando a sessão expirou, sem estourar erro 500", async () => {
  const { ErroAutenticacao } = await import("@/server/_shared");
  mocks.reposicao.mockRejectedValue(new ErroAutenticacao("Sessão do aluno inválida ou expirada."));

  // redirect() do Next lança um erro com digest NEXT_REDIRECT — é assim que ele "navega".
  await expect(Page({ params: Promise.resolve({ id: "reposicao-1" }) })).rejects.toMatchObject({
    digest: expect.stringContaining("NEXT_REDIRECT"),
  });
});

it("mostra 'não encontrado' (não 'sessão expirou') quando a reposição é de outro aluno", async () => {
  const { ErroPermissao } = await import("@/server/_shared");
  mocks.reposicao.mockRejectedValue(new ErroPermissao("Esta reposição não pertence ao aluno autenticado."));

  // notFound() do Next lança um erro com digest NEXT_HTTP_ERROR_FALLBACK;404 — não é a
  // mesma via do redirect de sessão, e a mensagem original de ErroPermissao não deve
  // aparecer para o aluno como se fosse instabilidade ou sessão expirada.
  await expect(Page({ params: Promise.resolve({ id: "reposicao-1" }) })).rejects.toMatchObject({
    digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK"),
  });
});

it("propaga erros que não são de autenticação nem de permissão (ex.: id ausente)", async () => {
  const { ErroRegra } = await import("@/server/_shared");
  mocks.reposicao.mockRejectedValue(new ErroRegra("Reposição não informada."));

  await expect(Page({ params: Promise.resolve({ id: "" }) })).rejects.toThrow("Reposição não informada.");
});
