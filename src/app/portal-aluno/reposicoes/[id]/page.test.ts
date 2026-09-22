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

it("propaga erros que não são de autenticação (ex.: reposição de outro aluno)", async () => {
  const { ErroPermissao } = await import("@/server/_shared");
  mocks.reposicao.mockRejectedValue(new ErroPermissao("Esta reposição não pertence ao aluno autenticado."));

  await expect(Page({ params: Promise.resolve({ id: "reposicao-1" }) })).rejects.toThrow(
    "Esta reposição não pertence ao aluno autenticado.",
  );
});
