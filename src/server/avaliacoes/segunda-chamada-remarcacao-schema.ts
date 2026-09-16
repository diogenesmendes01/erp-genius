import { createHash } from "node:crypto";
import { z } from "zod";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";

const id = z.string().trim().min(1).max(100);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const motivo = z.string().trim().min(5).max(2000);
const evidencia = z.string().trim().min(5).max(4000);
const chaveIdempotencia = z.string().trim().min(8).max(100);

function dataIsoComOffsetValida(valor: string) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})T/.exec(valor);
  if (!partes || Number.isNaN(Date.parse(valor))) return false;

  const ano = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  if (ano < 1 || ano > 9999 || mes < 1 || mes > 12 || dia < 1) return false;

  const bissexto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0);
  const diasNoMes = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
  if (dia > diasNoMes) return false;

  const instante = new Date(valor);
  return instante.getUTCFullYear() >= 1 && instante.getUTCFullYear() <= 9999;
}

const instante = z.string().datetime({ offset: true }).refine(dataIsoComOffsetValida, "Data ISO com offset inválida.");

/** Entrada estrita para propor a troca de horário de uma reserva já existente. */
export const ProporRemarcacaoSegundaChamadaSchema = z.object({
  reservaId: id,
  estadoConferido: sha256,
  inicio: instante,
  fim: instante,
  fusoOrigem: FusoInstitucionalSchema,
  motivo,
  evidencia,
  motivoExcecaoNaoLetiva: motivo.optional(),
  chaveIdempotencia,
}).strict();

/** Decisão independente sobre a proposta exata, sem dados de agenda implícitos. */
export const DecidirRemarcacaoSegundaChamadaSchema = z.object({
  propostaId: id,
  propostaHash: sha256,
  aprovada: z.boolean(),
  autorizarDiaNaoLetivo: z.boolean().default(false),
  motivo,
}).strict();

export type PropostaRemarcacaoSegundaChamadaNormalizada = z.infer<typeof ProporRemarcacaoSegundaChamadaSchema>;

/**
 * Canonicaliza instantes para UTC antes de calcular idempotência ou persistir.
 * A disponibilidade, o calendário, o prazo e a decisão continuam sendo
 * conferências do fluxo transacional.
 */
export function canonicalizarPropostaRemarcacaoSegundaChamada(input: z.input<typeof ProporRemarcacaoSegundaChamadaSchema>) {
  const proposta = ProporRemarcacaoSegundaChamadaSchema.parse(input);
  const inicio = new Date(proposta.inicio);
  const fim = new Date(proposta.fim);
  if (fim <= inicio) throw new Error("O fim precisa ser posterior ao início.");
  return { ...proposta, inicio: inicio.toISOString(), fim: fim.toISOString() };
}

export function normalizarPropostaRemarcacaoSegundaChamada(
  input: z.input<typeof ProporRemarcacaoSegundaChamadaSchema>,
  agora = new Date(),
): PropostaRemarcacaoSegundaChamadaNormalizada {
  const proposta = canonicalizarPropostaRemarcacaoSegundaChamada(input);
  if (!Number.isFinite(agora.getTime())) throw new Error("Referência de tempo inválida.");
  if (new Date(proposta.inicio) <= agora) throw new Error("O início precisa ser futuro.");
  return proposta;
}

/** O hash independe do relógio: permite conferir reenvio histórico antes de validar uma nova proposta. */
export function hashPropostaRemarcacaoSegundaChamada(
  input: z.input<typeof ProporRemarcacaoSegundaChamadaSchema>,
) {
  return createHash("sha256").update(JSON.stringify(canonicalizarPropostaRemarcacaoSegundaChamada(input))).digest("hex");
}
