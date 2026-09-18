import { z } from "zod";

const id = z.string().trim().min(1).max(100);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const chave = z.string().trim().min(1).max(200);
const justificativa = z.string().trim().min(5).max(2000);

export const PrepararImpactosTaxaAditivoSchema = z.object({
  matriculaId: id, propostaId: id, conclusaoId: id, revisaoHash: hash,
  linhas: z.array(z.object({ cobrancaId: id, decisao: z.enum(["AFETADA", "PRESERVADA"]), justificativa }).strict()).min(1).max(200),
  chaveIdempotencia: chave,
}).strict().superRefine((v, ctx) => {
  if (new Set(v.linhas.map(l => l.cobrancaId)).size !== v.linhas.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cada taxa deve aparecer uma única vez." });
});

export const DecidirImpactosTaxaAditivoSchema = z.object({ conjuntoId: id, aprovada: z.boolean(), motivo: justificativa, chaveIdempotencia: chave }).strict();
export const VincularImpactoTaxaAditivoSchema = z.object({ conjuntoId: id, cobrancaId: id, propostaAcertoId: id }).strict();
export const CompletarImpactosTaxaAditivoSchema = z.object({ conjuntoId: id }).strict();
