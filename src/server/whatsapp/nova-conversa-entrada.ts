import { z } from "zod";
import { ChaveIdempotenciaSchema } from "@/server/_shared/validacao";
import { normalizarNumeroNovaConversa } from "./telefone-nova-conversa";

const id = z.string().trim().min(1).max(200);
const comum = { telefone: z.string().max(100), numeroId: id, chaveIdempotencia: ChaveIdempotenciaSchema };
export const EntradaNovaConversaSchema = z.discriminatedUnion("modo", [
 z.object({ ...comum, modo: z.literal("NOVO"), ownerId: id, nome: z.string().trim().min(1).max(200).optional() }).strict(),
 z.object({ ...comum, modo: z.literal("EXISTENTE") }).strict(),
]).transform(({ telefone, ...dados }, ctx) => {
 const telefoneE164 = normalizarNumeroNovaConversa(telefone);
 if (!telefoneE164) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe o telefone internacional válido.", path: ["telefone"] }); return z.NEVER; }
 return { ...dados, telefoneE164 };
});