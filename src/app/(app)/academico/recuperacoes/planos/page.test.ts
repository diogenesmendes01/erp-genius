import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn(), fuso: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/recuperacao-planos-consulta", () => ({ consultarPlanosRecuperacao: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/operacao/consultas", () => ({ consultarFusoInstitucional: mocks.fuso }));

import Page from "./page";

const dado = {
  identificacao: { aluno: "Ana", matriculaId: "matricula", matriculaCodigo: "M1", oferta: "Inglês", turma: "T1", nivel: "A1" },
  atual: { geral: null, minimoGeral: "6", habilidades: [] }, impedimentoProposta: null, autorizacaoPreparacao: { id: "autorizacao", prazoAte: "2026-10-01T02:30:00.000Z" },
  podeAutorizarPreparacao: false, podeConsultarHistoricoPreparacao: false, podePropor: false, versaoEsperada: 1, obrigatorias: [], selecionaveis: [], planos: [{
    id: "plano", versao: 1, preparador: "Prof. Ana", criadaEm: "2026-10-01T02:30:00.000Z", decisao: null, motivo: "Motivo", atividades: [],
    base: { geral: null, minimoGeral: "6", habilidades: [] }, fontesMudaram: false, podeDecidir: false, podeAprovar: false, propostaHash: null,
  }], proximaAntesVersao: null,
};

describe("planos de recuperação", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.sessao.mockResolvedValue({}); mocks.consultar.mockResolvedValue({ ok: true, dado }); mocks.fuso.mockResolvedValue(null); });

  it("exibe prazos e propostas UTC no fuso pessoal", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ alocacaoId: "matricula" }) }));
    expect(html).toMatch(/30\/09\/2026.*20:30/);
    expect(html).toContain("America/Costa_Rica; origem UTC");
  });

  it("recorre ao UTC de origem quando a preferência falha", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toMatch(/01\/10\/2026.*02:30/);
    expect(html).toContain("UTC; origem UTC");
  });

  it("não consulta dados sem sessão autorizada", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("Sem sessão");
    expect(mocks.consultar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
