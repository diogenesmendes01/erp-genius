import { z } from "zod";
import { TipoAjuste, Vigencia } from "@prisma/client";
import { ChaveIdempotenciaSchema, dataOpcional } from "@/server/_shared/validacao";

export const AjusteSchema = z.object({
  cobrancaId: z.string().min(1, "Cobrança obrigatória"),
  tipo: z.nativeEnum(TipoAjuste),
  valorPara: z.coerce.number().min(0, "Valor inválido"),
  vigencia: z.nativeEnum(Vigencia).default(Vigencia.ESTA_COBRANCA),
  novoVencimento: dataOpcional,
  motivo: z.string().min(1, "Motivo obrigatório (auditoria)"),
  chaveIdempotencia: ChaveIdempotenciaSchema.optional(),
});
export type AjusteInput = z.input<typeof AjusteSchema>;

export const DecisaoSchema = z.object({
  aprovar: z.boolean(),
  motivo: z.string().trim().max(2000).optional(),
}).superRefine((dados, ctx) => {
  if (dados.aprovar === false && (!dados.motivo || dados.motivo.trim().length < 5)) {
    ctx.addIssue({
      code: "custom",
      path: ["motivo"],
      message: "Informe o motivo da rejeição (mínimo de 5 caracteres) para orientar o vendedor.",
    });
  }
});
export type DecisaoInput = z.input<typeof DecisaoSchema>;
