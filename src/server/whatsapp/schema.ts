import { z } from "zod";

// Zod do módulo whatsapp (padrão docs/13). As ações da fila validam aqui.

export const LoteCobrancaSchema = z.object({
  cobrancaIds: z
    .array(z.string().min(1))
    .min(1, "Selecione ao menos uma cobrança.")
    .max(200, "Lote máximo: 200 cobranças por aprovação."),
});
export type LoteCobrancaInput = z.input<typeof LoteCobrancaSchema>;
