import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ consultar: vi.fn(), preferencia: vi.fn().mockResolvedValue({ ok: false, erro: "Indisponível" }) }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn() }));
vi.mock("@/server/avaliacoes/segunda-chamada-substituicao", () => ({ consultarSubstituicaoAgendaSegundaChamada: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }));
import Page from "./page";

describe("SubstituicaoAgendaSegundaChamadaPage", () => {
  it("mostra prévia, pendências, decisão independente e paginação sem expor IDs", async () => {
    mocks.consultar.mockResolvedValue({ ok: true, dado: {
      identificacao: { aluno: "Ana", matriculaCodigo: "M-1", turma: "T-1", codigoAvaliacao: "FALA" },
      encontro: { id: "encontro-interno", professorId: "p-atual", professorNome: "Professor atual", inicio: "2026-09-17T10:00:00.000Z", fim: "2026-09-17T11:00:00.000Z", fusoOrigem: "UTC", status: "PREVISTO" },
      professores: [{ id: "professor/novo", nome: "Professora nova" }],
      previa: { estadoConferido: "hash-interno", pendencias: ["Conflito de agenda a conferir."], substituto: { id: "professor/novo", nome: "Professora nova" } },
      podePropor: true, podeDecidir: true,
      itens: [{ id: "proposta-interna", versao: 4, autorNome: "Secretaria", substitutoNome: "Professora nova", motivo: "Cobrir impedimento", evidencia: "Documento conferido", criadaEm: "2026-09-16T10:00:00.000Z", entradaHash: "hash-interno", podeDecidir: true, podeAprovar: false, impedimentoAprovacao: "O vínculo de origem mudou; rejeite ou prepare nova proposta.", decisao: null, snapshot: { professorNome: "Professor anterior", inicio: "2026-09-17T10:00:00.000Z", fim: "2026-09-17T11:00:00.000Z", fusoOrigem: "UTC" } }],
      proximaVersao: 3,
    } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ reservaId: "reserva/a?" }), searchParams: Promise.resolve({ substitutoId: "professor/novo", antesVersao: "4" }) }));
    expect(html).toContain("Professor atual");
    expect(html).toContain("17/09/2026, 10:00 até 17/09/2026, 11:00 (UTC)");
    expect(html).toContain("Registrada em 16/09/2026, 10:00 (UTC; origem UTC).");
    expect(html).toContain("Professora nova");
    expect(html).toContain("Professor anterior");
    expect(html).toContain("Conflito de agenda a conferir.");
    expect(html).toContain("Aguardando decisão independente.");
    expect(html).toContain("O vínculo de origem mudou; rejeite ou prepare nova proposta.");
    expect(html).toContain("Rejeitar");
    expect(html).not.toContain("Aprovar substituição");
    expect(html).toContain("Propostas anteriores");
    expect(html).toContain("antesVersao=3");
    expect(html).not.toContain("hash-interno");
    expect(html).not.toContain("encontro-interno");
  });

  it("exibe agenda e registro na preferência pessoal de fuso", async () => {
    mocks.preferencia.mockResolvedValueOnce({ ok: true, dado: { fusoExibicao: "America/Sao_Paulo" } });
    mocks.consultar.mockResolvedValue({ ok: true, dado: {
      identificacao: { aluno: "Ana", matriculaCodigo: null, turma: "T-1", codigoAvaliacao: "FALA" },
      encontro: { id: "e", professorId: "p", professorNome: "Professor atual", inicio: "2026-09-17T10:00:00.000Z", fim: "2026-09-17T11:00:00.000Z", fusoOrigem: "UTC", status: "PREVISTO" },
      professores: [], previa: null, podePropor: false, podeDecidir: false, proximaVersao: null,
      itens: [{ id: "i", versao: 1, autorNome: "Secretaria", substitutoNome: "Nova", motivo: "Motivo", evidencia: "Evidência", criadaEm: "2026-09-16T10:00:00.000Z", entradaHash: null, podeDecidir: false, decisao: { aprovada: true, aplicada: true, decisorNome: "Gestão", motivo: "Ok", decididaEm: "2026-09-16T12:00:00.000Z" }, snapshot: { professorNome: "Anterior", inicio: "2026-09-17T10:00:00.000Z", fim: "2026-09-17T11:00:00.000Z", fusoOrigem: "UTC" } }],
    } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ reservaId: "r" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("17/09/2026, 07:00 até 17/09/2026, 08:00 (America/Sao_Paulo)");
    expect(html).toContain("Registrada em 16/09/2026, 07:00 (America/Sao_Paulo; origem UTC).");
    expect(html).toContain("Decisão em 16/09/2026, 09:00 (America/Sao_Paulo; origem UTC).");
  });

  it("mostra apenas o erro da consulta", async () => {
    mocks.consultar.mockResolvedValue({ ok: false, erro: "Reserva fora do escopo." });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ reservaId: "r" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("Reserva fora do escopo.");
    expect(html).not.toContain("Professor atual");
  });

  it("mantém a conferência visível quando a proposta está bloqueada por pendências", async () => {
    mocks.consultar.mockResolvedValue({ ok: true, dado: {
      identificacao: { aluno: "Ana", matriculaCodigo: null, turma: "T-1", codigoAvaliacao: "FALA" },
      encontro: { id: "e", professorId: "p", professorNome: "Professor atual", inicio: "2026-09-17T10:00:00.000Z", fim: "2026-09-17T11:00:00.000Z", fusoOrigem: "UTC", status: "PREVISTO" },
      professores: [{ id: "p2", nome: "Professor alternativo" }],
      previa: { estadoConferido: "estado", pendencias: ["Professor indisponível no horário."], substituto: { id: "p2", nome: "Professor alternativo" } },
      podePropor: false, podeDecidir: false, itens: [], proximaVersao: null,
    } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ reservaId: "r" }), searchParams: Promise.resolve({ substitutoId: "p2" }) }));
    expect(html).toContain("Professor indisponível no horário.");
    expect(html).toContain("Professor alternativo");
    expect(html).toContain("Enviar proposta");
  });
});
