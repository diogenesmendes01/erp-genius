import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/gravacoes/troca-fonte-reposicao", () => ({
  consultarTrocaFonteReposicaoGravacao: mocks.consultar, proporTrocaFonteReposicaoGravacao: vi.fn(), decidirTrocaFonteReposicaoGravacao: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import Page from "./page";

beforeEach(() => vi.resetAllMocks());

it("consulta somente a reposição contextual depois do guard de gestão", async () => {
  mocks.sessao.mockResolvedValue({ id: "gestao" });
  mocks.consultar.mockResolvedValue({
    contexto: { reposicaoId: "repo/1?", materialId: "material", matriculaId: "matricula", fonteMaterialAtual: { versao: 1, revisao: "material-r1" }, fontePublicacaoAtual: { versao: 2, revisao: "aula-r2" }, materialDisponivel: true, disponibilizacaoId: null, jaAdotaPublicacaoAtual: false },
    propostas: [{ id: "interna", motivo: "Adotar publicação corrigida da aula original.", criadaEm: new Date("2026-09-18T12:00:00.000Z"), versaoMaterialEsperada: 1, fonteMaterialAnterior: { versao: 1, driveRevisionId: "material-r1" }, fontePublicacao: { versao: 2, driveRevisionId: "aula-r2" }, preparadorId: "gestao-a", preparador: { nome: "Gestão A" }, podeDecidir: false, decisao: null, fonteMaterial: null }],
  });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "repo/1?" }) }));
  expect(mocks.sessao).toHaveBeenCalledWith(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
  expect(mocks.consultar).toHaveBeenCalledWith({ reposicaoId: "repo/1?" });
  expect(html).toContain("publicação v2 (aula-r2)");
  expect(html).not.toContain("interna");
});

it("não consulta a reposição quando o guard falha", async () => {
  mocks.sessao.mockRejectedValue(new Error("acesso negado"));
  await expect(Page({ params: Promise.resolve({ id: "repo" }) })).rejects.toThrow("acesso negado");
  expect(mocks.consultar).not.toHaveBeenCalled();
});
