import { describe, expect, it } from "vitest";
import {
  ConsultarSubstituicaoAgendaSegundaChamadaSchema,
  DecidirSubstituicaoAgendaSegundaChamadaSchema,
  hashSubstituicaoAgendaSegundaChamada,
  ProporSubstituicaoAgendaSegundaChamadaSchema,
} from "./segunda-chamada-substituicao-schema";

const proposta = () => ({
  reservaId: "reserva-1",
  substitutoId: "professor-2",
  estadoConferido: "a".repeat(64),
  motivo: "Substituição necessária para manter a segunda chamada.",
  evidencia: "Registro institucional que demonstra a indisponibilidade.",
  chaveIdempotencia: "substituicao-segunda-1",
});

describe("schema de substituição docente na agenda de segunda chamada", () => {
  it("aceita apenas a proposta exata e a decisão independente", () => {
    expect(ProporSubstituicaoAgendaSegundaChamadaSchema.safeParse(proposta()).success).toBe(true);
    expect(ProporSubstituicaoAgendaSegundaChamadaSchema.safeParse({ ...proposta(), professorId: "livre" }).success).toBe(false);
    expect(DecidirSubstituicaoAgendaSegundaChamadaSchema.safeParse({ propostaId: "proposta-1", propostaHash: "b".repeat(64), aprovada: true, motivo: "Aprovada após conferir o professor e a agenda." }).success).toBe(true);
    expect(ConsultarSubstituicaoAgendaSegundaChamadaSchema.safeParse({ reservaId: "reserva-1", substitutoId: "professor-2", antesVersao: 2 }).success).toBe(true);
  });

  it("mantém o hash do reenvio e muda quando qualquer dado material muda", () => {
    const entrada = proposta();
    expect(hashSubstituicaoAgendaSegundaChamada(entrada)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSubstituicaoAgendaSegundaChamada(entrada)).toBe(hashSubstituicaoAgendaSegundaChamada({ ...entrada }));
    expect(hashSubstituicaoAgendaSegundaChamada(entrada)).not.toBe(hashSubstituicaoAgendaSegundaChamada({ ...entrada, substitutoId: "professor-3" }));
  });
});
