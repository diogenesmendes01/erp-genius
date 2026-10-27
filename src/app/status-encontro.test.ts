import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusEncontroAgenda } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STATUS_ENCONTRO_LABEL } from "@/lib/labels";

const mocks = vi.hoisted(() => ({
  encontros: vi.fn(),
  regularizacoes: vi.fn(),
  agendas: vi.fn(),
  historico: vi.fn(),
  preferencia: vi.fn(),
}));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn(async () => ({ id: "u" })) }));
vi.mock("@/server/agenda/encontros-docente", () => ({ consultarEncontrosDocente: mocks.encontros }));
vi.mock("@/server/diario/regularizacao-consultas", () => ({ listarRegularizacoesAula: mocks.regularizacoes }));
vi.mock("@/server/avaliacoes/segunda-chamada-agendas", () => ({ listarAgendasSegundaChamada: mocks.agendas }));
vi.mock("@/server/avaliacoes/segunda-chamada-historico", () => ({ consultarHistoricoReservasSegundaChamada: mocks.historico }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/app/(app)/diario/regularizacoes/GerirDesignacoes", () => ({ GerirDesignacoes: () => null }));

import EncontrosPage from "@/app/(app)/diario/encontros/page";
import RegularizacoesPage from "@/app/(app)/diario/regularizacoes/page";
import AgendasPage from "@/app/(app)/academico/segundas-chamadas/agendas/page";
import HistoricoPage from "@/app/(app)/academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/historico/page";
import { ConteudoRevisao } from "@/app/(app)/academico/calendario/[id]/replanejamento/ConteudoRevisao";

const inicio = "2026-10-01T03:30:00.000Z", fim = "2026-10-01T04:30:00.000Z";

const TELAS: Record<string, (status: string) => Promise<string>> = {
  "/diario/encontros": async (status) => {
    mocks.encontros.mockResolvedValue({ ok: true, dado: { proximoCursor: null, encontros: [{ id: "e", turma: "T-1", status, inicio, fim, fusoExibicao: "UTC", fusoOrigem: "UTC", professor: "Ana", particular: false, atribuicaoPropria: false }] } });
    return renderToStaticMarkup(await EncontrosPage({ searchParams: Promise.resolve({}) }));
  },
  "/diario/regularizacoes": async (status) => {
    mocks.regularizacoes.mockResolvedValue({ ok: true, dado: { gestao: false, temAnterior: false, temProxima: false, anterior: null, proxima: null, itens: [{ id: "e", turma: "T-1", inicio, fim, fusoOrigem: "UTC", status, professor: "Ana", designacao: null, podeRegularizar: false, podeGerir: false }] } });
    return renderToStaticMarkup(await RegularizacoesPage({ searchParams: Promise.resolve({}) }));
  },
  "/academico/segundas-chamadas/agendas": async (status) => {
    mocks.agendas.mockResolvedValue({ ok: true, dado: { pagina: 1, temProxima: false, itens: [{
      reservaId: "r", statusReserva: "RESERVADA", codigoAvaliacao: "FALA", reservadaEm: inicio,
      matricula: { codigo: "M-1" }, aluno: "Ana", turma: { codigo: "T-1", nome: "Turma" },
      agenda: { inicio, fim, fusoOrigem: "UTC", status },
    }] } });
    return renderToStaticMarkup(await AgendasPage({ searchParams: Promise.resolve({}) }));
  },
  "histórico de segunda chamada": async (status) => {
    mocks.historico.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC", proximoId: null, itens: [{
      id: "r", status: "RESERVADA", reservadaEm: inicio, reservadaPor: "Gestão",
      encontro: { inicio, fim, status, professor: "Ana" }, ocorrencia: null, realizacao: null,
    }] } });
    return renderToStaticMarkup(await HistoricoPage({ params: Promise.resolve({ alocacaoId: "a", codigoAvaliacao: "A1" }), searchParams: Promise.resolve({}) }));
  },
  "replanejamento do calendário": async (status) => renderToStaticMarkup(createElement(ConteudoRevisao, {
    preferenciaFusoExibicao: null,
    r: { pendencias: [], recursos: { internos: [], externos: [], indisponibilidades: [], semDocenteApto: [] }, particulares: [],
      revisoes: [{ turmaId: "t", codigo: "T-1", fusoOrigem: "UTC", pendencias: [], previsao: { previsaoTermino: fim, propostas: [], preservados: [{ id: "p", inicio, fim, status: status as StatusEncontroAgenda }] } }] },
  })),
};

const ocorrencias = (html: string, rotulo: string) => html.split(rotulo).length - 1;

describe("status do encontro no masculino, em todas as telas que o mostram", () => {
  beforeEach(() => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: null } });
  });

  it("o mapa central concorda com \"encontro\" e é somente leitura", () => {
    expect(STATUS_ENCONTRO_LABEL).toEqual({
      RASCUNHO: "Rascunho",
      PREVISTO: "Previsto",
      MINISTRADO: "Ministrado",
      CANCELADO: "Cancelado",
      NAO_REALIZADO: "Não realizado",
      IMPEDIDO_ESCOLA: "Impedido pela escola",
    });
    expect(Object.isFrozen(STATUS_ENCONTRO_LABEL)).toBe(true);
  });

  for (const [tela, renderizar] of Object.entries(TELAS)) {
    it(`${tela}: cada um dos seis status aparece com o rótulo do mapa central`, async () => {
      const base = await renderizar("STATUS_DESCONHECIDO");
      for (const status of Object.values(StatusEncontroAgenda)) {
        const html = await renderizar(status);
        const rotulo = STATUS_ENCONTRO_LABEL[status];
        expect(ocorrencias(html, rotulo) - ocorrencias(base, rotulo), `${tela} · ${status} → "${rotulo}"`).toBeGreaterThanOrEqual(1);
        for (const feminino of ["Prevista", "Ministrada", "Cancelada", "Não realizada", "Impedida pela escola"]) {
          expect(html, `${tela} · ${status}`).not.toContain(feminino);
        }
      }
    });
  }
});
