import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn() }));

vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/gravacoes/regularizacao-fonte", () => ({
  consultarRegularizacoesFonteGravacao: mocks.consultar,
  proporRegularizacaoFonteGravacao: vi.fn(),
  decidirRegularizacaoFonteGravacao: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import Page from "./page";

beforeEach(() => vi.resetAllMocks());

describe("RegularizacoesGravacaoPage", () => {
  it("interrompe no guard de gestão antes de consultar fontes e propostas", async () => {
    mocks.sessao.mockRejectedValue(new Error("acesso negado"));

    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("acesso negado");

    expect(mocks.sessao).toHaveBeenCalledWith(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
    expect(mocks.consultar).not.toHaveBeenCalled();
  });

  it("lista a fonte selecionável e decide pela proposta exibida, sem campo de id de proposta", async () => {
    mocks.sessao.mockResolvedValue({ id: "gestao" });
    mocks.consultar.mockResolvedValue({
      publicacoes: [{ id: "publicacao/1?", encontroId: "encontro/1?", encontro: { inicio: new Date(), turma: { codigo: "T-1" } }, arquivoOficialId: "arquivo-interno", criadaEm: new Date(), fontesRevisao: [] }],
      materiais: [{ id: "material/1?", reposicaoId: "reposicao/1?", reposicao: { matricula: { codigo: "M-1", aluno: { primeiroNome: "Aluno", sobrenome: "Teste" } } }, arquivoOficialId: "arquivo-material", publicadoEm: new Date(), fontesRevisao: [{ versao: 2 }] }],
      propostas: [{ id: "proposta-interna", podeDecidir: true, alvo: "MATERIAL_REPOSICAO", publicacaoAulaId: null, materialReposicaoId: "material/1?", arquivoOficialId: "arquivo-fixo", driveRevisionId: "revisao-fixa", motivo: "Revisão confirmada pela equipe.", versaoEsperada: 2, criadaEm: new Date(), preparador: { nome: "Gestão A" }, decisao: null }],
      podeDecidir: true,
    });

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("Reposição M-1");
    expect(html).toContain("MATERIAL_REPOSICAO:material/1?");
    expect(html).toContain("Revisão fixada: revisao-fixa");
    expect(html).toContain("Aprovar fonte");
    expect(html).not.toMatch(/name=\"propostaId\"/);
    expect(html).not.toContain("proposta-interna");
  });
});
