import { z } from "zod";
import { FormaPagamento } from "@prisma/client";
import { dataOpcional } from "@/server/_shared/validacao";

// Baixa manual (ver docs/09 §Financeiro). Parciais acumulam em valorRecebido; saldo = ACUMULADO.
export const PagamentoSchema = z.object({
  valorRecebido: z.coerce.number().positive("Valor deve ser maior que zero"),
  forma: z.nativeEnum(FormaPagamento).default(FormaPagamento.TRANSFERENCIA),
  dataPagamento: dataOpcional,
  comprovanteUrl: z.string().optional(),
  comentario: z.string().optional(),
  // Recebimento acima do negociado é bloqueado por padrão; só passa como crédito explícito.
  permitirExcedente: z.coerce.boolean().optional().default(false),
});
export type PagamentoInput = z.input<typeof PagamentoSchema>;

// Modelos de cobrança via WhatsApp (wa.me, sem Cloud API).
export const MODELOS_WHATSAPP = ["amigavel", "vencida", "firme", "dados", "promessa"] as const;
export type ModeloWhatsapp = (typeof MODELOS_WHATSAPP)[number];
