import { z } from "zod";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";

/** Projeção de leitura do registro histórico; nunca recalcula a agenda atual. */
export const ReplanejamentoSnapshotSchema = z.object({
  calendarioId: z.string().min(1), conferidoEm: z.string().datetime(), pendencias: z.array(z.string()),
  revisoes: z.array(z.object({
    turmaId: z.string(), codigo: z.string().nullable(), fusoOrigem: FusoInstitucionalSchema.nullable(), pendencias: z.array(z.string()),
    previsao: z.object({
      previsaoTermino: z.string().datetime().nullable(),
      propostas: z.array(z.object({ encontroId: z.string(), inicioAnterior: z.string().datetime(), fimAnterior: z.string().datetime(),
        inicioProposto: z.string().datetime(), fimProposto: z.string().datetime(), alterado: z.boolean(), motivoAjuste: z.string().nullable().optional(), periodosNaoLetivos: z.array(z.string()).optional() })),
      preservados: z.array(z.object({ id: z.string(), inicio: z.string().datetime(), fim: z.string().datetime(), status: z.enum(["PREVISTO", "MINISTRADO", "CANCELADO", "RASCUNHO", "NAO_REALIZADO", "IMPEDIDO_ESCOLA"]) })),
    }).nullable(),
  })),
  recursos: z.object({
    internos: z.array(z.object({ primeiro: z.string(), segundo: z.string() })),
    externos: z.array(z.object({ encontroPropostoId: z.string(), encontroExistenteId: z.string() })),
    indisponibilidades: z.array(z.object({ encontroId: z.string(), indisponibilidadeId: z.string() })),
    semDocenteApto: z.array(z.string()),
  }),
  particulares: z.array(z.object({ id: z.string(), inicio: z.string().datetime(), fim: z.string().datetime() })),
  recuperacoes: z.array(z.object({ id: z.string(), inicio: z.string().datetime(), fim: z.string().datetime() })).optional(),
});
export type ReplanejamentoSnapshot = z.infer<typeof ReplanejamentoSnapshotSchema>;
