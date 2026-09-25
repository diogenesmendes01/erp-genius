import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusEncontroAgenda } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STATUS_ENCONTRO_LABEL } from "@/lib/labels";

// Status do encontro (StatusEncontroAgenda) no masculino em todas as telas — concorda com "encontro";
// decisão do responsável em 25/09/2026. A trava é de COMPORTAMENTO: cada tela que mostra o status é
// renderizada com cada um dos seis estados e precisa exibir o rótulo de STATUS_ENCONTRO_LABEL. Não
// importa como um mapa local seria escrito (objeto, Map, atribuição, constante renomeada, rótulo
// único sobrescrito): se a tela mostrar outro texto, o teste quebra. Os textos distintivos do status
// ficam proibidos fora de src/lib/labels.ts, para telas novas não montarem o próprio rótulo.

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

/** Cada tela que mostra o status do encontro, renderizada com um status qualquer. */
const TELAS: Record<string, (status: string) => Promise<string>> = {
  "/diario/encontros": async (status) => {
    mocks.encontros.mockResolvedValue({ ok: true, dado: { proximoCursor: null, encontros: [{ id: "e", turma: "T-1", status, inicio, fim, fusoExibicao: "UTC", fusoOrigem: "UTC", professor: "Ana", particular: false, atribuicaoPropria: false }] } });
    return renderToStaticMarkup(await EncontrosPage({ searchParams: Promise.resolve({}) }));
  },
  "/diario/regularizacoes": async (status) => {
    mocks.regularizacoes.mockResolvedValue({ ok: true, dado: { gestao: false, proximoCursor: null, itens: [{ id: "e", turma: "T-1", inicio, fim, fusoOrigem: "UTC", status, professor: "Ana", designacao: null, podeRegularizar: false, podeGerir: false }] } });
    return renderToStaticMarkup(await RegularizacoesPage({ searchParams: Promise.resolve({}) }));
  },
  "/academico/segundas-chamadas/agendas": async (status) => {
    mocks.agendas.mockResolvedValue({ ok: true, dado: { proximoCursor: null, itens: [{
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
      // Linha de base com um status desconhecido: o rótulo testado tem de aparecer A MAIS, e só por causa do status.
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

// Telas novas: os textos distintivos do status só existem em src/lib/labels.ts. ("Cancelado",
// "Rascunho" e "Não realizado" são comuns a outras entidades e não entram — as telas acima são
// travadas pelo comportamento.)
const TEXTOS_DO_STATUS = /^(Previst[oa]|Ministrad[oa]|Impedid[oa] pela escola)$/;
const fontes = ["src/app", "src/components"].flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.(t|j)sx?$/.test(f) && !/\.test\./.test(f))
    .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") })),
);

describe("rótulo do status do encontro só no mapa central", () => {
  it("nenhuma tela (ts, tsx, js, jsx) escreve \"Previsto\", \"Ministrado\" ou \"Impedido pela escola\" — nem no feminino", () => {
    const ofensores = fontes.flatMap(({ arquivo, conteudo }) =>
      [...conteudo.matchAll(/["'`>]\s*([^"'`<>{}]{3,40}?)\s*["'`<]/g)].map((m) => m[1].trim()).filter((t) => TEXTOS_DO_STATUS.test(t)).map((t) => `${arquivo}: ${t}`),
    );
    expect(ofensores).toEqual([]);
  });

  it("o detector pega o texto em string, template e JSX, e ignora frase que só contém a palavra", () => {
    const achar = (fonte: string) => [...fonte.matchAll(/["'`>]\s*([^"'`<>{}]{3,40}?)\s*["'`<]/g)].map((m) => m[1].trim()).filter((t) => TEXTOS_DO_STATUS.test(t));
    expect(achar('const r = { PREVISTO: "Prevista" };')).toEqual(["Prevista"]);
    expect(achar("const r = new Map().set(P, 'Ministrado');")).toEqual(["Ministrado"]);
    expect(achar("const r = `Impedido pela escola`;")).toEqual(["Impedido pela escola"]);
    expect(achar("<span>Previsto</span>")).toEqual(["Previsto"]);
    expect(achar('<p>"Encontro previsto para amanhã"</p>')).toEqual([]);
  });
});
