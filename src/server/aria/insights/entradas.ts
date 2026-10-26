import { z } from "zod";
import { ChaveIdempotenciaSchema } from "@/server/_shared/validacao";
const Id=z.string().min(1).max(100);
const Versao=z.number().int().min(0).max(2_147_483_647);
const Hash=z.string().regex(/^[a-f0-9]{64}$/);
export const NovoInsightSchema=z.object({atendimentoId:Id,chaveTentativa:ChaveIdempotenciaSchema}).strict("Entrada inválida de geração de Insights.");
export const RetomarInsightSchema=z.object({atendimentoId:Id,geracaoId:Id,versaoEsperada:Versao,contextoAtualEsperadoHash:Hash}).strict("Entrada inválida de retomada de Insights.");
export const AtualizarInsightSchema=z.discriminatedUnion("tipo",[
  NovoInsightSchema.extend({tipo:z.literal("NOVO")}).strict("Entrada inválida de geração de Insights."),
  RetomarInsightSchema.extend({tipo:z.literal("RETOMAR")}).strict("Entrada inválida de retomada de Insights."),
]);
const BaseOperacao=z.object({atendimentoId:Id,geracaoId:Id,versaoEsperada:Versao,contextoAtualEsperadoHash:Hash});
export const ReconciliarInsightSchema=BaseOperacao.extend({estadoEsperado:z.literal("PROCESSANDO"),chaveReconciliacao:ChaveIdempotenciaSchema}).strict("Entrada inválida de reconciliação de Insights.");
export const DescartarInsightSchema=BaseOperacao.extend({estadoEsperado:z.literal("INCERTO"),chaveDescarte:ChaveIdempotenciaSchema}).strict("Entrada inválida de descarte de Insights.");
export type NovoInsightInput=z.input<typeof NovoInsightSchema>;
export type AtualizarInsightInput=z.input<typeof AtualizarInsightSchema>;
export type ReconciliarInsightInput=z.input<typeof ReconciliarInsightSchema>;
export type DescartarInsightInput=z.input<typeof DescartarInsightSchema>;
