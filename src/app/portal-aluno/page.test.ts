import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), reposicoes: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/portal-aluno/sessao", () => ({ exigirSessaoPortalAluno: mocks.sessao }));
vi.mock("@/server/portal-aluno/reposicoes", () => ({ listarReposicoesDoPortalAluno: mocks.reposicoes }));
vi.mock("@/server/portal-aluno/preferencia-fuso", () => ({ consultarPreferenciaFusoPortalAluno: mocks.preferencia }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
import Page from "./page";
it("exibe dataResultado no fuso da conta ao atravessar o dia UTC", async () => {
  mocks.sessao.mockResolvedValue({ email: "aluna@teste" }); mocks.preferencia.mockResolvedValue({ fusoExibicao: "America/Costa_Rica" });
  mocks.reposicoes.mockResolvedValue([{ id: "r", modalidade: "PARTICULAR", concluida: true, autorizada: true, dataResultado: new Date("2026-01-01T02:30:00.000Z") }]);
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain("31/12/2025"); expect(html).toContain("20:30"); expect(html).toContain("America/Costa_Rica");
});
