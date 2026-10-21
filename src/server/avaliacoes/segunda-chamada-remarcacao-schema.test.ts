import { describe, expect, it } from "vitest";
import {
  DecidirRemarcacaoSegundaChamadaSchema,
  hashPropostaRemarcacaoSegundaChamada,
  normalizarPropostaRemarcacaoSegundaChamada,
  ProporRemarcacaoSegundaChamadaSchema,
} from "./segunda-chamada-remarcacao-schema";

const agora = new Date("2026-09-15T12:00:00.000Z");

function proposta() {
  return {
    reservaId: "reserva-1",
    estadoConferido: "a".repeat(64),
    inicio: "2026-09-16T10:00:00.000-03:00",
    fim: "2026-09-16T11:00:00.000-03:00",
    fusoOrigem: "America/Sao_Paulo",
    motivo: "Horário alternativo conferido pela equipe.",
    evidencia: "Registro institucional que fundamenta a alteração.",
    chaveIdempotencia: "remarcacao-segunda-1",
  };
}

describe("schema de remarcação da segunda chamada", () => {
  it("aceita contratos estritos e decisão com hash da proposta", () => {
    expect(ProporRemarcacaoSegundaChamadaSchema.safeParse(proposta()).success).toBe(true);
    expect(DecidirRemarcacaoSegundaChamadaSchema.safeParse({ propostaId: "proposta-1", propostaHash: "b".repeat(64), aprovada: true, autorizarDiaNaoLetivo: false, motivo: "Aprovada após conferir a agenda." }).success).toBe(true);
    expect(DecidirRemarcacaoSegundaChamadaSchema.parse({ propostaId: "proposta-1", propostaHash: "b".repeat(64), aprovada: true, motivo: "Aprovada após conferir a agenda." }).autorizarDiaNaoLetivo).toBe(false);
    expect(ProporRemarcacaoSegundaChamadaSchema.safeParse({ ...proposta(), professorId: "professor-2" }).success).toBe(false);
    expect(ProporRemarcacaoSegundaChamadaSchema.safeParse({ ...proposta(), fusoOrigem: "Brasil" }).success).toBe(false);
  });

  it("normaliza offsets equivalentes em UTC e mantém o fuso informado no hash", () => {
    const local = proposta();
    const utc = { ...proposta(), inicio: "2026-09-16T13:00:00.000Z", fim: "2026-09-16T14:00:00.000Z" };

    expect(normalizarPropostaRemarcacaoSegundaChamada(local, agora)).toMatchObject({
      inicio: "2026-09-16T13:00:00.000Z",
      fim: "2026-09-16T14:00:00.000Z",
      fusoOrigem: "America/Sao_Paulo",
    });
    expect(hashPropostaRemarcacaoSegundaChamada(local)).toBe(hashPropostaRemarcacaoSegundaChamada(utc));
  });

  it("aceita intervalo futuro que cruza a meia-noite", () => {
    const resultado = normalizarPropostaRemarcacaoSegundaChamada({
      ...proposta(),
      inicio: "2026-09-16T23:30:00.000-03:00",
      fim: "2026-09-17T00:30:00.000-03:00",
    }, agora);
    expect(resultado.inicio).toBe("2026-09-17T02:30:00.000Z");
    expect(resultado.fim).toBe("2026-09-17T03:30:00.000Z");
  });

  it("recusa fim igual, início passado e datas de calendário inválidas", () => {
    expect(() => normalizarPropostaRemarcacaoSegundaChamada({ ...proposta(), fim: proposta().inicio }, agora)).toThrow("fim");
    expect(() => normalizarPropostaRemarcacaoSegundaChamada({ ...proposta(), inicio: "2026-09-15T08:00:00.000Z", fim: "2026-09-15T09:00:00.000Z" }, agora)).toThrow("início");
    expect(ProporRemarcacaoSegundaChamadaSchema.safeParse({ ...proposta(), inicio: "2026-02-30T10:00:00.000Z" }).success).toBe(false);
  });
});

it("hash permite conferir reenvio histórico sem autorizar nova proposta passada", () => {
  const entrada = { ...proposta(), inicio: "2020-01-01T10:00:00Z", fim: "2020-01-01T11:00:00Z" };
  expect(hashPropostaRemarcacaoSegundaChamada(entrada)).toMatch(/^[a-f0-9]{64}$/);
  expect(() => normalizarPropostaRemarcacaoSegundaChamada(entrada, agora)).toThrow("futuro");
});
