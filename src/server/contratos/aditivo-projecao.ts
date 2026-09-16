import { z } from "zod";
import { OrigemCampoSchema } from "./campos";
import { TextoPreviaSchema } from "./previa-projecao";

/** Apenas conteúdo histórico destinado à revisão; não publica a entrada ou evidências. */
export const ProjecaoAditivoSchema = z.object({
  base: z.object({ ambiente: z.enum(["SANDBOX", "PRODUCAO"]), artefatoOriginalId: z.string().min(1).max(100), modeloCodigo: z.string(), modeloVersao: z.number().int().positive() }),
  alteracoes: z.array(z.object({ campo: OrigemCampoSchema, rotulo: z.string(), anterior: z.string(), novo: z.string() })),
  documento: TextoPreviaSchema.shape.documento,
}).strip();
