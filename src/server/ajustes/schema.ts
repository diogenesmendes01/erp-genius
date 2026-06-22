import { z } from "zod";
import { TipoAjuste, Vigencia } from "@prisma/client";
import { dataOpcional } from "@/server/_shared/validacao";

// Renegociação / Ajuste manual (ver docs/09 §Renegociação). Tudo com motivo + auditoria.
// A DIREÇÃO do ajuste (desconto deve ter valorPara <= valor atual; só ALTERACAO_VALOR
// pode aumentar) depende do valor atual da cobrança e é validada em acoes.ts via
// validarDirecaoAjuste — aqui só garantimos um valor não-negativo.
export const AjusteSchema = z.object({
  cobrancaId: z.string().min(1, "Cobrança obrigatória"),
  tipo: z.nativeEnum(TipoAjuste),
  valorPara: z.coerce.number().min(0, "Valor inválido"),
  vigencia: z.nativeEnum(Vigencia).default(Vigencia.ESTA_COBRANCA),
  novoVencimento: dataOpcional,
  motivo: z.string().min(1, "Motivo obrigatório (auditoria)"),
});
export type AjusteInput = z.input<typeof AjusteSchema>;

export const DecisaoSchema = z.object({
  aprovar: z.boolean(),
  motivo: z.string().optional(),
});
export type DecisaoInput = z.input<typeof DecisaoSchema>;
