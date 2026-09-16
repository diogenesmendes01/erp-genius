import { expect, it } from "vitest";
import { DecidirAgendaInicialSegundaChamadaSchema, ProporAgendaInicialSegundaChamadaSchema,
  hashAgendaInicialSegundaChamada, normalizarAgendaInicialSegundaChamada } from "./segunda-chamada-agenda-inicial-schema";

const agora = new Date("2026-09-15T12:00:00Z");
const proposta = () => ({ propostaSegundaChamadaId: "avaliacao-pendente", professorId: "docente",
  estadoConferido: "a".repeat(64), inicio: "2026-09-16T23:30:00-03:00", fim: "2026-09-17T00:30:00-03:00",
  fusoOrigem: "America/Sao_Paulo", motivo: "Agenda conferida com o aluno", evidencia: "Registro institucional do horário",
  chaveIdempotencia: "agenda-inicial-teste" });

it("normaliza encontro que atravessa meia-noite e reconhece offsets equivalentes", () => {
  const utc = { ...proposta(), inicio: "2026-09-17T02:30:00Z", fim: "2026-09-17T03:30:00Z" };
  expect(normalizarAgendaInicialSegundaChamada(proposta(), agora).fim).toBe("2026-09-17T03:30:00.000Z");
  expect(hashAgendaInicialSegundaChamada(proposta())).toBe(hashAgendaInicialSegundaChamada(utc));
  for (const alteracao of [{ professorId: "outro-docente" }, { propostaSegundaChamadaId: "outra-avaliacao" },
    { motivoExcecaoNaoLetiva: "Exceção para o encontro identificado" }, { estadoConferido: "b".repeat(64) }]) {
    expect(hashAgendaInicialSegundaChamada({ ...proposta(), ...alteracao })).not.toBe(hashAgendaInicialSegundaChamada(proposta()));
  }
});

it("recusa data inexistente, intervalo vazio, fonte ausente e campos de aplicação enviados pelo cliente", () => {
  expect(ProporAgendaInicialSegundaChamadaSchema.safeParse({ ...proposta(), inicio: "2026-02-30T10:00:00Z" }).success).toBe(false);
  expect(() => normalizarAgendaInicialSegundaChamada({ ...proposta(), fim: proposta().inicio }, agora)).toThrow("fim");
  expect(ProporAgendaInicialSegundaChamadaSchema.safeParse({ ...proposta(), propostaSegundaChamadaId: "" }).success).toBe(false);
  for (const campo of ["reservaId", "decisorId", "encontroId", "autorId", "calendarioId"]) {
    expect(ProporAgendaInicialSegundaChamadaSchema.safeParse({ ...proposta(), [campo]: "injetado" }).success).toBe(false);
  }
});

it("distingue replay histórico de nova proposta e não presume aprovação de exceção", () => {
  const passada = { ...proposta(), inicio: "2020-01-01T10:00:00Z", fim: "2020-01-01T11:00:00Z" };
  expect(hashAgendaInicialSegundaChamada(passada)).toMatch(/^[a-f0-9]{64}$/);
  expect(() => normalizarAgendaInicialSegundaChamada(passada, agora)).toThrow("futuro");
  const decisao = { propostaId: "agenda-proposta", propostaHash: "b".repeat(64), aprovada: true, motivo: "Conferida de forma independente" };
  expect(DecidirAgendaInicialSegundaChamadaSchema.parse(decisao).autorizarDiaNaoLetivo).toBe(false);
  expect(DecidirAgendaInicialSegundaChamadaSchema.safeParse({ ...decisao, aprovada: false, autorizarDiaNaoLetivo: true }).success).toBe(false);
});
