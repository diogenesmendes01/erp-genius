import { z } from "zod";
import { OutrasCobrancasEncerramentoSchema } from "./encerramento-outras-cobrancas-schema";
import { DataCivilSchema } from "./cobertura";
const valor = z.string().regex(/^\d+(?:\.\d{1,2})?$/, "Use valor não negativo com até duas casas decimais.");
export const ConferenciaMensalEncerramentoSchema = z.object({
  matriculaId: z.string().min(1),
  condicoesId: z.string().min(1),
  outrasCobrancas: OutrasCobrancasEncerramentoSchema.optional(),
  parcelas: z.array(z.object({
    cobrancaId: z.string().min(1), versao: z.number().int().nonnegative(),
    valorBase: valor, descontoValido: valor,
    evidenciaCondicoes: z.string().trim().min(5).max(2000),
  }).strict()).max(1000),
  multa: z.discriminatedUnion("tipo", [
    z.object({ tipo: z.literal("SEM_PREVISAO") }).strict(),
    z.object({ tipo: z.literal("APLICAR"), evidenciaAplicabilidade: z.string().trim().min(5).max(2000), baseCalculo: valor.optional(), vencimento: DataCivilSchema.optional(),
      excecao: z.discriminatedUnion("tipo", [
        z.object({ tipo: z.literal("DISPENSAR"), motivo: z.string().trim().min(5).max(2000) }).strict(),
        z.object({ tipo: z.literal("ALTERAR"), valorProposto: valor, motivo: z.string().trim().min(5).max(2000) }).strict(),
      ]).optional(),
    }).strict(),
  ]),
}).strict();
export const PreviaMensalPedidoEncerramentoSchema = z.object({
  solicitacaoId: z.string().min(1), alunoId: z.string().min(1),
  contratos: z.array(ConferenciaMensalEncerramentoSchema).min(1).max(100),
}).strict();
export type PreviaMensalPedidoEncerramentoInput = z.input<typeof PreviaMensalPedidoEncerramentoSchema>;
