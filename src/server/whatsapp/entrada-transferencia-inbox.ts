import { z } from "zod";
import { ChaveIdempotenciaSchema } from "@/server/_shared/validacao";
export const TransferirPessoaInboxSchema = z.object({ atendimentoId: z.string().min(1), usuarioId: z.string().min(1), contexto: z.string().trim().max(1000).default(""), chaveIdempotencia: ChaveIdempotenciaSchema });
