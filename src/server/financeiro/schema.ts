import { z } from "zod";
import { FormaPagamento } from "@prisma/client";
import { dataOpcional } from "@/server/_shared/validacao";

export const FORMAS_EXIGEM_COMPROVANTE: FormaPagamento[] = [
  FormaPagamento.TRANSFERENCIA,
  FormaPagamento.GREENPAY,
];

export const PagamentoSchema = z
  .object({
    chaveIdempotencia: z.string().min(16, "Identificador do pagamento inválido").max(120),
    valorRecebido: z.coerce.number().min(0.01, "Informe um valor recebido de ao menos um centavo").finite(),
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
    permitirExcedente: z.boolean().optional().default(false),
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

export const ConferenciaSchema = z.object({
  versao: z.number().int().positive(),
  confirmar: z.boolean(),
  motivo: z.string().trim().max(1000).optional(),
}).refine((d) => d.confirmar || !!d.motivo, { message: "Informe o motivo da rejeição.", path: ["motivo"] });

export const PoliticaComissaoSchema = z.object({
  paisId: z.string().min(1), produtoId: z.string().min(1),
  tipo: z.enum(["PERCENTUAL", "VALOR_FIXO"]),
  percentual: z.number().min(0).max(100).finite().nullable(),
  valorFixo: z.number().min(0).finite().nullable(),
  moeda: z.string().trim().regex(/^[A-Z]{3}$/),
  vigenteEm: z.coerce.date(),
}).superRefine((d, ctx) => {
  if (d.tipo === "PERCENTUAL" ? d.percentual === null || d.valorFixo !== null : d.valorFixo === null || d.percentual !== null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tipo"], message: "Preencha somente o valor correspondente ao tipo da comissão." });
  }
});
export type PoliticaComissaoInput = z.input<typeof PoliticaComissaoSchema>;

export const MODELOS_WHATSAPP = ["amigavel", "vencida", "firme", "dados", "promessa"] as const;
export type ModeloWhatsapp = (typeof MODELOS_WHATSAPP)[number];

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
