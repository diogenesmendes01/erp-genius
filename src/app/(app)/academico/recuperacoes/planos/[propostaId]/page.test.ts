import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ consultar: vi.fn(), preferencia: vi.fn(), fuso: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn() }));
vi.mock("@/server/avaliacoes/recuperacao-operacao", () => ({ consultarOperacaoRecuperacao: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/operacao/consultas", () => ({ consultarFusoInstitucional: mocks.fuso }));
vi.mock("../../../avaliacoes/Identificacao", () => ({ IdentificacaoAvaliacao: () => "Identificação" }));
vi.mock("./Formularios", () => ({
  Disponibilizar: () => "Disponibilizar",
  Reservar: () => "Reservar",
  CancelarPelaEscola: () => "Cancelar",
  Realizar: ({ somenteHistorica }: { somenteHistorica?: boolean }) => somenteHistorica ? "Formulário histórico" : "Formulário atual",
}));
vi.mock("./PreviaAgenda", () => ({ PreviaAgenda: () => "Prévia" }));
vi.mock("../../AgendaPublicada", () => ({ AgendaPublicada: () => "Agenda" }));

import Page from "./page";

describe("operação de recuperação", () => {
  it("mantém formulário histórico após pausa sem oferecer realização nova", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
    mocks.fuso.mockResolvedValue(null);
    mocks.consultar.mockResolvedValue({ ok: true, dado: {
      propostaId: "plano", versao: 1, aprovadaEm: "2026-09-18T10:00:00.000Z", alocacaoId: "alocacao", propostaHash: null,
      identificacao: {}, fontesMudaram: false, vinculoValido: false, prazoMinutos: 60, situacaoContratual: "PAUSADA",
      podeGerirDesignacoes: false, autorizacaoDisponibilizacao: null, podeDisponibilizar: false, podeReservar: false,
      disponibilizacao: null, saldo: [], proximoId: null,
      reservas: [{ id: "reserva", motivo: "Motivo válido", criadaEm: "2026-09-18T10:00:00.000Z", cancelamento: null, podeCancelarPelaEscola: false, itens: [{
        id: "item", habilidade: "FALA", agenda: null, realizacao: null, autorizacaoEspecialAte: null,
        podeRegistrarHistorica: true, podeRegistrarAgora: false, podeRegistrarRealizacao: true,
      }] }],
    } });

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ propostaId: "plano" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("Sem autorização específica vigente para uma nova realização");
    expect(html).toContain("Formulário histórico");
    expect(html).not.toContain("Formulário atual");
  });

  it("exibe os instantes administrativos no fuso preferido", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    mocks.fuso.mockResolvedValue(null);
    mocks.consultar.mockResolvedValue({ ok: true, dado: {
      propostaId: "plano", versao: 1, aprovadaEm: "2026-10-01T02:30:00.000Z", alocacaoId: "alocacao", propostaHash: null,
      identificacao: {}, fontesMudaram: false, vinculoValido: true, prazoMinutos: 60, situacaoContratual: "ATIVA",
      podeGerirDesignacoes: false, autorizacaoDisponibilizacao: null, podeDisponibilizar: false, podeReservar: false,
      disponibilizacao: null, saldo: [], reservas: [], proximoId: null,
    } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ propostaId: "plano" }), searchParams: Promise.resolve({}) }));
    expect(html).toMatch(/30\/09\/2026.*20:30/);
    expect(html).toContain("America/Costa_Rica; origem UTC");
  });

  it("recorre ao UTC de origem quando a preferência falha", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    mocks.fuso.mockResolvedValue(null);
    mocks.consultar.mockResolvedValue({ ok: true, dado: {
      propostaId: "plano", versao: 1, aprovadaEm: "2026-10-01T02:30:00.000Z", alocacaoId: "alocacao", propostaHash: null,
      identificacao: {}, fontesMudaram: false, vinculoValido: true, prazoMinutos: 60, situacaoContratual: "ATIVA",
      podeGerirDesignacoes: false, autorizacaoDisponibilizacao: null, podeDisponibilizar: false, podeReservar: false,
      disponibilizacao: null, saldo: [], reservas: [], proximoId: null,
    } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ propostaId: "plano" }), searchParams: Promise.resolve({}) }));
    expect(html).toMatch(/01\/10\/2026.*02:30/);
    expect(html).toContain("UTC; origem UTC");
  });
});
