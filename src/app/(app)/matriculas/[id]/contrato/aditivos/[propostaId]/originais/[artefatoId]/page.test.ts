import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), assinatura: vi.fn(), processo: vi.fn(), conclusao: vi.fn(), final: vi.fn(), condicoes: vi.fn(), aplicacao: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/contratos/aditivo-assinatura", () => ({ consultarAssinaturaAditivo: mocks.assinatura }));
vi.mock("@/server/contratos/aditivo-envio", () => ({ consultarProcessoAssinaturaAditivo: mocks.processo }));
vi.mock("@/server/contratos/aditivo-conclusao", () => ({ consultarConclusaoAssinaturaAditivo: mocks.conclusao }));
vi.mock("@/server/contratos/aditivo-conferencia-final", () => ({ consultarConferenciaFinalAditivo: mocks.final }));
vi.mock("@/server/contratos/aditivo-condicoes", () => ({ consultarCondicoesAditivo: mocks.condicoes, consultarAplicacaoCondicoesAditivo: mocks.aplicacao }));

import Page from "./page";

describe("ConferenciaOriginalAditivoPage", () => {
  it("mantém a aplicação histórica visível quando a revisão atual foi superada", async () => {
    mocks.sessao.mockResolvedValue({});
    mocks.assinatura.mockResolvedValue({ ok: true, dado: { revisao: null, historico: [], pendencia: null, temProxima: false } });
    mocks.processo.mockResolvedValue({ ok: true, dado: null });
    mocks.conclusao.mockResolvedValue({ ok: true, dado: { id: "conclusao", ambiente: "PRODUCAO", fornecedor: "ZAPSIGN", concluidaEm: new Date("2026-09-17T12:00:00Z"), assinaturas: [] } });
    mocks.final.mockResolvedValue({ ok: true, dado: { revisao: null, historico: { autor: "Secretaria", motivo: "Conferência preservada" }, pendencia: null } });
    mocks.aplicacao.mockResolvedValue({ ok: true, dado: { versao: 3, aplicacao: { id: "aplicacao", aplicadaEm: new Date("2026-09-17T13:00:00Z") } } });

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "matricula/a", propostaId: "proposta", artefatoId: "artefato" }), searchParams: Promise.resolve({}) }));

    expect(mocks.aplicacao).toHaveBeenCalledWith({ matriculaId: "matricula/a", propostaId: "proposta" });
    expect(html).toContain("Condições aplicadas");
    expect(html).toContain("Versão 3 aplicada em 2026-09-17 13:00:00 UTC.");
    expect(html).not.toContain("Formalizar e aplicar condições");
  });
});
