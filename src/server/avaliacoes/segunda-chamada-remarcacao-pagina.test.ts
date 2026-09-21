import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { consulta, sessao } = vi.hoisted(() => ({ consulta: vi.fn(), sessao: vi.fn() }));

vi.mock("@/server/avaliacoes/segunda-chamada-remarcacao", () => ({
  consultarRemarcacoesAgendaSegundaChamada: consulta,
}));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: sessao }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({
  consultarPreferenciaFusoEquipe: vi.fn().mockResolvedValue({ ok: true, dado: { fusoExibicao: null } }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href }, children),
}));
vi.mock("@/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/remarcacao/Formulario", () => ({
  Formulario: ({ proposta }: { proposta?: { id: string; podeAprovar?: boolean; impedimentoAprovacao?: string | null } }) => React.createElement(
    "button",
    { type: "button", "data-formulario": proposta ? "decisao" : "proposta" },
    proposta ? (proposta.podeAprovar === false ? `Rejeitar: ${proposta.impedimentoAprovacao}` : "Aprovar e remarcar / Rejeitar") : "Enviar proposta",
  ),
}));

import Page from "@/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/remarcacao/page";

const atual = {
  encontro: {
    inicio: "2026-09-16T10:00:00.000Z",
    fim: "2026-09-16T11:00:00.000Z",
    fusoOrigem: "UTC",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("React", React);
  sessao.mockResolvedValue({ id: "gestor" });
});

afterEach(() => vi.unstubAllGlobals());

it("renderiza a conferência dos horários, escapa motivo/evidência e limita os formulários pelas permissões", async () => {
  consulta.mockResolvedValue({
    ok: true,
    dado: {
      identificacao: { aluno: "Ana", matriculaCodigo: "M/1", turma: "Turma 1", nivel: "Nível 1" },
      conferencia: { contextoVigente: true, reservaId: "reserva-1", codigoAvaliacao: "I1", professorAtual: { id: "professor-1", nome: "Prof. João" }, prazoVigente: "2026-09-20T18:00:00.000Z", fusoExibicao: "UTC" },
      atual,
      estadoHash: "a".repeat(64),
      podePropor: true,
      proximoId: "proposta/antiga",
      itens: [
        {
          id: "proposta-sem-decisao",
          versao: 2,
          autorNome: "Secretaria",
          inicio: "2026-09-17T12:30:00.000Z",
          fim: "2026-09-17T13:30:00.000Z",
          fusoOrigem: "UTC",
          motivo: "<script>motivo</script>",
          evidencia: "<img src=x onerror=alert(1)>",
          snapshot: atual,
          entradaHash: "b".repeat(64),
          decisao: null,
          podeDecidir: true,
        },
        {
          id: "proposta-aprovada",
          versao: 1,
          autorNome: "Outra pessoa",
          inicio: "2026-09-17T14:30:00.000Z",
          fim: "2026-09-17T15:30:00.000Z",
          fusoOrigem: "UTC",
          motivo: "Motivo histórico válido",
          evidencia: "Evidência histórica válida",
          snapshot: atual,
          entradaHash: "c".repeat(64),
          decisao: { aprovada: true, decisorNome: "Gestão", motivo: "Conferência concluída", encontroNovoId: "novo" },
          podeDecidir: false,
        },
      ],
    },
  });

  const html = renderToStaticMarkup(await Page({
    params: Promise.resolve({ reservaId: "reserva/1" }),
    searchParams: Promise.resolve({ antesId: "cursor/1" }),
  }));

  expect(html).toContain("Agenda atual");
  expect(html).toContain("Conferência da reserva");
  expect(html).toContain("reserva-1");
  expect(html).toContain("I1");
  expect(html).toContain("Prof. João");
  expect(html).toContain("20/09/2026");
  expect(html).toContain("(UTC)");
  expect(html).toContain("Horário anterior:");
  expect(html).toContain("Horário proposto:");
  expect(html).toContain("16/09/2026");
  expect(html).toContain("17/09/2026");
  expect(html).toContain("data-formulario=\"proposta\"");
  expect(html).toContain("data-formulario=\"decisao\"");
  expect(html.match(/data-formulario=/g)).toHaveLength(2);
  expect(html).toContain("&lt;script&gt;motivo&lt;/script&gt;");
  expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img src=");
  expect(sessao).toHaveBeenCalledWith("SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO", "ADMINISTRADOR");
  expect(html).toContain('href="/academico/segundas-chamadas/reservas/reserva%2F1/remarcacao"');
  expect(html).toContain('href="/academico/segundas-chamadas/reservas/reserva%2F1/remarcacao?antesId=proposta%2Fantiga"');
  expect(html).not.toContain("${");
  expect(consulta).toHaveBeenCalledWith({ reservaId: "reserva/1", antesId: "cursor/1" });
});

it("não mostra formulários quando a revisão não permite propor ou decidir", async () => {
  consulta.mockResolvedValue({
    ok: true,
    dado: {
      identificacao: { aluno: "Ana", matriculaCodigo: null, turma: "Turma 1", nivel: "Nível 1" },
      conferencia: { contextoVigente: true, reservaId: "reserva-1", codigoAvaliacao: "I1", professorAtual: null, prazoVigente: null, fusoExibicao: "UTC" },
      atual,
      estadoHash: "a".repeat(64),
      podePropor: false,
      proximoId: null,
      itens: [{
        id: "proposta-1", versao: 1, autorNome: "Secretaria",
        inicio: "2026-09-17T12:30:00.000Z", fim: "2026-09-17T13:30:00.000Z", fusoOrigem: "UTC",
        motivo: "Motivo histórico válido", evidencia: "Evidência histórica válida", snapshot: atual,
        entradaHash: "b".repeat(64), decisao: null, podeDecidir: false,
      }],
    },
  });

  const html = renderToStaticMarkup(await Page({
    params: Promise.resolve({ reservaId: "reserva-1" }),
    searchParams: Promise.resolve({}),
  }));
  expect(html).not.toContain("data-formulario=");
  expect(html).toContain("Sem professor definido");
  expect(html).toContain("Disponibilização sem prazo registrado");
  expect(html).toContain("Aguardando decisão independente.");
});

it("mostra somente o erro quando a consulta não retorna dados", async () => {
  consulta.mockResolvedValue({ ok: false, erro: "Acesso negado" });
  const html = renderToStaticMarkup(await Page({
    params: Promise.resolve({ reservaId: "reserva-1" }),
    searchParams: Promise.resolve({}),
  }));
  expect(html).toBe('<p role="alert">Acesso negado</p>');
});

it("mantém a rejeição e oculta aprovação quando o vínculo da proposta foi superado", async () => {
  consulta.mockResolvedValue({ ok: true, dado: { identificacao: { aluno: "Ana", matriculaCodigo: "M1", turma: "T1", nivel: "N1" }, conferencia: { contextoVigente: false, reservaId: "reserva-historica", codigoAvaliacao: "I1", professorAtual: null, prazoVigente: null, fusoExibicao: "UTC" }, atual, estadoHash: "a".repeat(64), podePropor: false, proximoId: null, itens: [{ id: "stale", versao: 1, autorNome: "Secretaria", inicio: "2026-09-17T12:30:00.000Z", fim: "2026-09-17T13:30:00.000Z", fusoOrigem: "UTC", motivo: "Motivo válido", evidencia: "Evidência válida", snapshot: atual, entradaHash: "b".repeat(64), decisao: null, podeDecidir: true, podeAprovar: false, impedimentoAprovacao: "O vínculo de origem mudou; rejeite ou prepare nova proposta." }] } });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ reservaId: "reserva" }), searchParams: Promise.resolve({}) }));
  expect(html).toContain("Rejeitar: O vínculo de origem mudou; rejeite ou prepare nova proposta.");
  expect(html).toContain("Conferência histórica da reserva");
  expect(html).toContain("não autorizam nova remarcação");
  expect(html).not.toContain("Professor atual:");
  expect(html).toContain("Agenda registrada");
  expect(html).not.toContain("Agenda atual");
  expect(html).not.toContain("Aprovar e remarcar / Rejeitar");
});
