import { z } from "zod";
import { ChaveIdempotenciaSchema } from "@/server/_shared/validacao";
import { ErroRegra } from "@/server/_shared/sessao";

export type AgendarMensagemInput = {
  numeroId: string;
  texto: string;
  agendadaPara: string;
  validaAte?: string;
  tarefaId?: string;
  leadId?: string;
  pessoaId?: string;
  atendimentoId?: string;
  chaveIdempotencia?: string;
};

const MSG_FUTURO = "Escolha uma data e hora no futuro.";

export const InstanteSchema = z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), "Informe uma data e hora válidas.");
export const AgendarSchema = z.object({
  numeroId: z.string().min(1, "Escolha o número de envio."),
  texto: z.string().trim().min(1, "Escreva a mensagem.").max(4096, "A mensagem deve ter até 4096 caracteres."),
  agendadaPara: InstanteSchema,
  validaAte: InstanteSchema.optional(),
  tarefaId: z.string().min(1).optional(),
  leadId: z.string().min(1).optional(),
  pessoaId: z.string().min(1).optional(),
  atendimentoId: z.string().min(1).optional(),
  chaveIdempotencia: ChaveIdempotenciaSchema.optional(),
});

export function futuro(v: string, agora = new Date()): Date {
  const d = new Date(v);
  if (d.getTime() <= agora.getTime()) throw new ErroRegra(MSG_FUTURO);
  return d;
}

export function dataFutura(m: { validaAte: Date | null }, quando: Date) {
  if (m.validaAte && m.validaAte.getTime() <= quando.getTime()) throw new ErroRegra("A nova data passa da validade da mensagem.");
}
