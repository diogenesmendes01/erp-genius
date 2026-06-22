import { z } from "zod";
import { FormaPagamento } from "@prisma/client";
import { dataOpcional } from "@/server/_shared/validacao";

// Baixa manual (ver docs/09 §Financeiro). Parciais modelados (valorRecebido/saldo).
export const PagamentoSchema = z.object({
  valorRecebido: z.coerce.number().min(0, "Valor inválido"),
  forma: z.nativeEnum(FormaPagamento).default(FormaPagamento.TRANSFERENCIA),
  dataPagamento: dataOpcional,
  comprovanteUrl: z.string().optional(),
  comentario: z.string().optional(),
});
export type PagamentoInput = z.input<typeof PagamentoSchema>;

// Modelos de cobrança via WhatsApp (wa.me, sem Cloud API).
export const MODELOS_WHATSAPP = ["amigavel", "vencida", "firme", "dados", "promessa"] as const;
export type ModeloWhatsapp = (typeof MODELOS_WHATSAPP)[number];
