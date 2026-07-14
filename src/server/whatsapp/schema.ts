import { z } from "zod";
import { telefoneE164 } from "@/server/_shared/validacao";

// Zod do módulo whatsapp (padrão docs/13). As ações da fila, da inbox e das telas de
// config validam aqui.

export const LoteCobrancaSchema = z.object({
  cobrancaIds: z
    .array(z.string().min(1))
    .min(1, "Selecione ao menos uma cobrança.")
    .max(200, "Lote máximo: 200 cobranças por aprovação."),
});
export type LoteCobrancaInput = z.input<typeof LoteCobrancaSchema>;

// ---------------------------------------------------------------------------
// Inbox (E3)
// ---------------------------------------------------------------------------

export const EnviarTextoInboxSchema = z.object({
  conversaId: z.string().min(1),
  texto: z.string().trim().min(1, "Escreva a mensagem.").max(4096, "Mensagem longa demais (máx. 4096)."),
});
export type EnviarTextoInboxInput = z.input<typeof EnviarTextoInboxSchema>;

export const EnviarMidiaInboxSchema = z.object({
  conversaId: z.string().min(1),
  /** URL canônica devolvida pelo POST /api/upload. */
  url: z.string().startsWith("/api/files/", "Envie o arquivo pelo uploader do sistema."),
  legenda: z.string().trim().max(1024, "Legenda longa demais.").optional().default(""),
});
export type EnviarMidiaInboxInput = z.input<typeof EnviarMidiaInboxSchema>;

export const VincularContatoSchema = z.object({
  contatoId: z.string().min(1),
  alvo: z.discriminatedUnion("tipo", [
    z.object({ tipo: z.literal("aluno"), id: z.string().min(1) }),
    z.object({ tipo: z.literal("responsavel"), id: z.string().min(1) }),
    z.object({ tipo: z.literal("lead"), id: z.string().min(1) }),
  ]),
});
export type VincularContatoInput = z.input<typeof VincularContatoSchema>;

export const TratarConversaSchema = z.object({
  conversaId: z.string().min(1),
  motivo: z.enum(["retomar_regua", "promessa", "pagamento"]),
});
export type TratarConversaInput = z.input<typeof TratarConversaSchema>;

// ---------------------------------------------------------------------------
// Config — número (E3)
// ---------------------------------------------------------------------------

export const NumeroWhatsAppSchema = z.object({
  id: z.string().min(1).optional(),
  telefoneE164,
  rotulo: z.string().trim().min(2, "Dê um rótulo ao número (ex.: Cobrança)." ).max(60),
  driver: z.enum(["META_CLOUD", "BAILEYS"]),
  finalidade: z.enum(["COBRANCA", "VENDAS"]),
  providerRef: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : null)),
  donoId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
  ativo: z.boolean().default(true),
});
export type NumeroWhatsAppInput = z.input<typeof NumeroWhatsAppSchema>;

// ---------------------------------------------------------------------------
// Config — template (E4). Nome segue a regra da Meta: minúsculas/dígitos/underscore.
// ---------------------------------------------------------------------------

export const TemplateWhatsAppSchema = z.object({
  id: z.string().min(1).optional(),
  nome: z
    .string()
    .trim()
    .min(2)
    .max(512)
    .regex(/^[a-z0-9_]+$/, "Nome no padrão da Meta: minúsculas, números e _ (ex.: cobranca_vencida)."),
  corpo: z.string().trim().min(5, "Escreva o corpo do template.").max(1024, "A Meta limita o corpo a 1024 caracteres."),
  idioma: z
    .string()
    .trim()
    .regex(/^[a-z]{2}(_[A-Z]{2})?$/, "Código de idioma da Meta (ex.: es, pt_BR)."),
  categoria: z.enum(["utility", "marketing"]).default("utility"),
});
export type TemplateWhatsAppInput = z.input<typeof TemplateWhatsAppSchema>;

// ---------------------------------------------------------------------------
// Config — política da régua (E4)
// ---------------------------------------------------------------------------

export const PASSOS_POLITICA = ["D-7", "D-3", "D0", "D+3", "D+7", "D+15"] as const;

export const DegrauPoliticaSchema = z.object({
  passo: z.enum(PASSOS_POLITICA),
  offsetDias: z.number().int().min(-30).max(90),
  modo: z.enum(["AUTOMATICO", "MANUAL", "LOTE"]),
  ativo: z.boolean(),
  templateId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
});

export const PoliticaReguaSchema = z
  .object({
    estado: z.enum(["DESLIGADA", "SHADOW", "ATIVA"]),
    janelaInicio: z.number().int().min(0).max(23),
    janelaFim: z.number().int().min(1).max(24),
    diasSemana: z.array(z.number().int().min(0).max(6)).min(1, "Escolha ao menos um dia da semana."),
    tetoPorContatoDia: z.number().int().min(1).max(10),
    silencioPosInboundHoras: z.number().int().min(0).max(720),
    killSwitch: z.boolean(),
    numeroRemetenteId: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null)),
    degraus: z.array(DegrauPoliticaSchema).min(1),
  })
  .refine((p) => p.janelaFim > p.janelaInicio, {
    message: "A janela precisa terminar depois de começar.",
    path: ["janelaFim"],
  });
export type PoliticaReguaInput = z.input<typeof PoliticaReguaSchema>;
