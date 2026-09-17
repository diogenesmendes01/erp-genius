import { ParticipacaoAula } from "@prisma/client";
import { z } from "zod";

const evidencia = z.record(z.string().trim().min(1), z.union([z.string().trim().min(1), z.number().finite(), z.boolean()])).refine((v) => Object.keys(v).length > 0, "Informe evidência verificável.");

export const PropostaPresencaHistoricaMigracaoSchema = z.object({
  linhaId: z.string().min(1), aulaId: z.string().min(1), presencaOrigemId: z.string().trim().min(1).max(200),
  participacao: z.nativeEnum(ParticipacaoAula).refine((v) => v === "PRESENTE" || v === "FALTA", "Escolha presença ou falta."),
  evidencia, chaveIdempotencia: z.string().uuid(),
}).strict();

export const DecisaoPresencaHistoricaMigracaoSchema = z.object({
  propostaId: z.string().min(1), aprovada: z.boolean(), motivo: z.string().trim().min(10).max(1000), chaveIdempotencia: z.string().uuid(),
}).strict();

export const ResolucaoDivergenciaPresencaHistoricaMigracaoSchema = z.object({
  aplicacaoId: z.string().min(1), resultado: z.enum(["RECONCILIADA", "MANTIDA"]), evidencia, chaveIdempotencia: z.string().uuid(),
}).strict();
