import { z } from "zod";
import { FormaPagamento } from "@prisma/client";
import { dataOpcional } from "@/server/_shared/validacao";

// Formas em que o comprovante é essencial pro fluxo (doc 09 §Registrar pagamento:
// "Essencial pro fluxo de transferência — anexa a prova"). GreenPay também gera prova.
export const FORMAS_EXIGEM_COMPROVANTE: FormaPagamento[] = [
  FormaPagamento.TRANSFERENCIA,
  FormaPagamento.GREENPAY,
];

// Baixa manual (ver docs/09 §Financeiro). Parciais acumulam em valorRecebido; saldo = ACUMULADO.
// O comprovante é exigido quando a forma de pagamento gera prova (transferência/GreenPay),
// mantendo o comportamento consistente entre painel financeiro e ficha do aluno.
export const PagamentoSchema = z
  .object({
    valorRecebido: z.coerce.number().min(0, "Valor inválido"),
    forma: z.nativeEnum(FormaPagamento).default(FormaPagamento.TRANSFERENCIA),
    dataPagamento: dataOpcional,
    comprovanteUrl: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : undefined)),
    comprovanteNome: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : undefined)),
    comentario: z.string().optional(),
    // Recebimento acima do negociado é bloqueado por padrão; só passa como crédito explícito.
    permitirExcedente: z.coerce.boolean().optional().default(false),
  })
  .superRefine((dados, ctx) => {
    if (FORMAS_EXIGEM_COMPROVANTE.includes(dados.forma) && !dados.comprovanteUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["comprovanteUrl"],
        message: "Comprovante obrigatório para esta forma de pagamento.",
      });
    }
  });
export type PagamentoInput = z.input<typeof PagamentoSchema>;

// Modelos de cobrança via WhatsApp (wa.me, sem Cloud API).
export const MODELOS_WHATSAPP = ["amigavel", "vencida", "firme", "dados", "promessa"] as const;
export type ModeloWhatsapp = (typeof MODELOS_WHATSAPP)[number];

// Câmbio (Fase B): cotação manual por moeda para CONSOLIDAÇÃO gerencial. `unidadesPorUsd` =
// quantas unidades da moeda equivalem a 1 USD (pivô). USD não é cadastrado (é sempre 1).
export const TaxaCambioSchema = z.object({
  moeda: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "Moeda em 3 letras (ex.: CRC, BRL)")
    .transform((s) => s.toUpperCase())
    .refine((m) => m !== "USD", "USD é o pivô (cotação fixa em 1) — não precisa cadastrar."),
  unidadesPorUsd: z.coerce.number().positive("A cotação deve ser maior que zero."),
});
export const SalvarTaxasCambioSchema = z.object({
  entradas: z.array(TaxaCambioSchema).min(1, "Informe ao menos uma cotação."),
});
export type SalvarTaxasCambioInput = z.input<typeof SalvarTaxasCambioSchema>;
