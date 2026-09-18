import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ consultar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn() }));
vi.mock("@/server/avaliacoes/recuperacao-operacao", () => ({ consultarOperacaoRecuperacao: mocks.consultar }));
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
});
