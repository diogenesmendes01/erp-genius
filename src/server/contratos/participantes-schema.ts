import { z } from "zod";
import { RegraAssinaturaSchema } from "./modelo-schema";
export const IdentidadeSignatarioSchema = z.object({ nome: z.string().trim().min(1).max(200), email: z.string().trim().email().max(254), documento: z.string().trim().min(1).max(100) }).strict();
export const ConferirParticipantesSchema = z.object({
  previaId: z.string().min(1), versaoEsperada: z.number().int().nonnegative(),
  maioridade: z.object({ classificacao: z.enum(["MAIOR", "MENOR"]), criterio: z.string().trim().min(5).max(2000), evidenciaDocumentoId: z.string().min(1) }).strict().nullable(),
  participantes: z.array(z.object({
    papel: RegraAssinaturaSchema.shape.papel,
    // Para aluno/pagador esta identidade é comparada ao cadastro/snapshot. Para
    // representantes é a pessoa natural conferida, com lastro documental.
    identidade: IdentidadeSignatarioSchema,
    representacao: z.object({ descricao: z.string().trim().min(5).max(2000), evidenciaDocumentoId: z.string().min(1) }).strict().optional(),
  }).strict()).min(1).max(5),
  identificacoesConferidas: z.literal(true), motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100),
}).strict().superRefine((d, ctx) => {
  if (new Set(d.participantes.map((p) => p.papel)).size !== d.participantes.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Identifique cada papel uma única vez." });
});
