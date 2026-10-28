import { z } from "zod";
import { SETORES, type Setor } from "./setor";
import { ChaveIdempotenciaSchema } from "@/server/_shared/validacao";
export const TransferirPessoaInboxSchema = z.object({ atendimentoId: z.string().min(1), usuarioId: z.string().min(1), contexto: z.string().trim().max(1000).default(""), anexarResumoAria: z.boolean().default(false), chaveIdempotencia: ChaveIdempotenciaSchema });
export const TransferirSetorInboxSchema = z.object({ atendimentoId: z.string().min(1), destino: z.enum(SETORES as [Setor, ...Setor[]]), destinoChave: z.string().min(1).nullable(), contexto: z.string().trim().max(1000).default(""), anexarResumoAria: z.boolean().default(false), chaveIdempotencia: ChaveIdempotenciaSchema });
