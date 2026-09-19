import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), consultarPreferenciaFusoEquipe: vi.fn() }));

vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/gravacoes/regularizacao-fonte", () => ({
  consultarRegularizacoesFonteGravacao: mocks.consultar,
  proporRegularizacaoFonteGravacao: vi.fn(),
  decidirRegularizacaoFonteGravacao: vi.fn(),
}));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.consultarPreferenciaFusoEquipe }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import Page from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.consultarPreferenciaFusoEquipe.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
});

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
      publicacoes: [{ id: "publicacao/1?", encontroId: "encontro/1?", encontro: { inicio: new Date(), fusoOrigem: "UTC", turma: { codigo: "T-1" } }, arquivoOficialId: "arquivo-interno", criadaEm: new Date(), fontesRevisao: [] }],
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

  it("renderiza o mesmo instante no fuso pessoal e atravessa o dia sem alterar a origem UTC", async () => {
    mocks.sessao.mockResolvedValue({ id: "gestao" });
    const instante = new Date("2026-01-01T02:30:00.000Z");
    mocks.consultar.mockResolvedValue({
      publicacoes: [{ id: "publicacao-fuso", encontroId: "encontro-fuso", encontro: { inicio: instante, fusoOrigem: "UTC", turma: { codigo: "T-FUSO" } }, arquivoOficialId: "arquivo", criadaEm: instante, fontesRevisao: [{ versao: 1 }] }],
      materiais: [],
      propostas: [{ id: "proposta-fuso", podeDecidir: false, alvo: "PUBLICACAO_AULA", publicacaoAulaId: "publicacao-fuso", materialReposicaoId: null, arquivoOficialId: "arquivo", driveRevisionId: "rev-1", motivo: "Conferência de horário transfronteiriço.", versaoEsperada: 1, criadaEm: instante, preparador: { nome: "Gestão" }, decisao: null, publicacaoAula: { encontro: { inicio: instante, fusoOrigem: "UTC", turma: { codigo: "T-FUSO" } } } }],
      podeDecidir: false,
    });
    mocks.consultarPreferenciaFusoEquipe.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    const costaRica = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));

    mocks.consultarPreferenciaFusoEquipe.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
    const utc = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));

    expect(costaRica).toContain("31/12/2025");
    expect(costaRica).toContain("America/Costa_Rica");
    expect(costaRica).toContain("origem UTC");
    expect(utc).toContain("01/01/2026");
    expect(utc).toContain("UTC");
    expect(costaRica).not.toContain("01/01/2026");
  });
});
