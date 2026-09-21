import { createHash } from "node:crypto";
import { z } from "zod";

const id = z.string().trim().min(1).max(100);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const motivo = z.string().trim().min(5).max(2000);
const evidencia = z.string().trim().min(5).max(4000);
const chaveIdempotencia = z.string().trim().min(8).max(100);

export const ConsultarSubstituicaoAgendaSegundaChamadaSchema = z.object({
  reservaId: id,
  substitutoId: id.optional(),
  antesVersao: z.number().int().positive().optional(),
}).strict();

export const ProporSubstituicaoAgendaSegundaChamadaSchema = z.object({
  reservaId: id,
  substitutoId: id,
  estadoConferido: sha256,
  motivo,
  evidencia,
  chaveIdempotencia,
}).strict();

export const DecidirSubstituicaoAgendaSegundaChamadaSchema = z.object({
  propostaId: id,
  propostaHash: sha256,
  aprovada: z.boolean(),
  motivo,
}).strict();

export type EntradaSubstituicaoAgendaSegundaChamada = z.input<typeof ProporSubstituicaoAgendaSegundaChamadaSchema>;

/** Canonicalização sem relógio preserva a semântica de reenvio idempotente. */
export function canonicalizarSubstituicaoAgendaSegundaChamada(input: EntradaSubstituicaoAgendaSegundaChamada) {
  return ProporSubstituicaoAgendaSegundaChamadaSchema.parse(input);
}

export function hashSubstituicaoAgendaSegundaChamada(input: EntradaSubstituicaoAgendaSegundaChamada) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalizarSubstituicaoAgendaSegundaChamada(input)))
    .digest("hex");
}