import { createHash } from "node:crypto";
import { z } from "zod";
import { ProporRemarcacaoSegundaChamadaSchema } from "./segunda-chamada-remarcacao-schema";

const id = z.string().trim().min(1).max(100);
const motivo = z.string().trim().min(5).max(2000);

/** A fonte é a avaliação autorizada; não existe reserva antes da aplicação inicial. */
export const ProporAgendaInicialSegundaChamadaSchema = ProporRemarcacaoSegundaChamadaSchema
  .omit({ reservaId: true })
  .extend({ propostaSegundaChamadaId: id, professorId: id })
  .strict();

export const DecidirAgendaInicialSegundaChamadaSchema = z.object({
  propostaId: id,
  propostaHash: z.string().regex(/^[a-f0-9]{64}$/),
  aprovada: z.boolean(),
  autorizarDiaNaoLetivo: z.boolean().default(false),
  motivo,
}).strict().superRefine((entrada, contexto) => {
  if (!entrada.aprovada && entrada.autorizarDiaNaoLetivo) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, path: ["autorizarDiaNaoLetivo"],
      message: "Uma rejeição não pode autorizar exceção de calendário." });
  }
});

export type EntradaAgendaInicialSegundaChamada = z.input<typeof ProporAgendaInicialSegundaChamadaSchema>;

/** Sem relógio: reenvio histórico deve ser reconhecido antes de conferir nova criação. */
export function canonicalizarAgendaInicialSegundaChamada(input: EntradaAgendaInicialSegundaChamada) {
  const entrada = ProporAgendaInicialSegundaChamadaSchema.parse(input);
  const inicio = new Date(entrada.inicio), fim = new Date(entrada.fim);
  if (fim <= inicio) throw new Error("O fim precisa ser posterior ao início.");
  return { ...entrada, inicio: inicio.toISOString(), fim: fim.toISOString() };
}

export function normalizarAgendaInicialSegundaChamada(input: EntradaAgendaInicialSegundaChamada, agora = new Date()) {
  const entrada = canonicalizarAgendaInicialSegundaChamada(input);
  if (!Number.isFinite(agora.getTime())) throw new Error("Referência de tempo inválida.");
  if (new Date(entrada.inicio) <= agora) throw new Error("O início precisa ser futuro.");
  return entrada;
}

export function hashAgendaInicialSegundaChamada(input: EntradaAgendaInicialSegundaChamada) {
  return createHash("sha256").update(JSON.stringify(canonicalizarAgendaInicialSegundaChamada(input))).digest("hex");
}
