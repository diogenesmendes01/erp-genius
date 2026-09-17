import { z } from "zod";

const id = z.string().trim().min(1).max(100);
const chave = z.string().trim().min(1).max(200);
export const ProporAcertoTaxaSchema = z.object({ matriculaId: id, propostaAditivoId: id, conclusaoId: id, revisaoHash: z.string().regex(/^[a-f0-9]{64}$/), cobrancaId: id, motivo: z.string().trim().min(5).max(2000), evidencia: z.record(z.unknown()), chaveIdempotencia: chave }).strict();
export const DecidirAcertoTaxaSchema = z.object({ propostaId: id, aprovada: z.boolean(), motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: chave }).strict();
export const AplicarAcertoTaxaSchema = z.object({ propostaId: id, chaveIdempotencia: chave }).strict();
