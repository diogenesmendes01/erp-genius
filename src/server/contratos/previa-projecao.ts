import { z } from "zod";
import { OrigemCampoSchema } from "./campos";
import { PlanoAssinaturasSchema } from "./exigencias-assinatura";

// Projeção do conteúdo histórico. Não reconstrói campos a partir do cadastro atual.
export const TextoPreviaSchema = z.object({
  assinaturasPlanejadas: PlanoAssinaturasSchema.optional(),
  modeloCodigo: z.string(), modeloVersao: z.number().int(), condicoesVersao: z.number().int(), aplicacao: z.string(),
  documento: z.object({ titulo: z.string(), secoes: z.array(z.object({ titulo: z.string(), texto: z.string() })),
    campos: z.array(z.object({ chave: z.string(), origem: OrigemCampoSchema, valor: z.string() })) }),
}).strip();
