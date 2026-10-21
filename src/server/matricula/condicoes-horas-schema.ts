import { z } from "zod";

/** Transcrição do contrato confirmado; não cria condições comerciais novas. */
export const RegrasHorasSchema = z.object({
  valorHora: z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/), moeda: z.string().regex(/^[A-Z]{3}$/),
  unidadeMinutos: z.literal(60), vigenteDesde: z.string().datetime({ offset: true }),
  antecedenciaCancelamentoMinutos: z.number().int().nonnegative().max(5256000),
  clausulaPreco: z.string().trim().min(1).max(2000), clausulaCancelamento: z.string().trim().min(1).max(2000),
}).strict();
