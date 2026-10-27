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
  perguntarSeResponder?: boolean;
  midiaUrl?: string;
  documentoPropostaId?: string;
  anexoNome?: string;
  chaveIdempotencia?: string;
};

const MSG_FUTURO = "Escolha uma data e hora no futuro.";

export const InstanteSchema = z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), "Informe uma data e hora válidas.");
export const TextoAgendadaSchema = z.string().trim().min(1, "Escreva a mensagem.").max(4096, "A mensagem deve ter até 4096 caracteres.");
export const LegendaAgendadaSchema = z.string().trim().max(4096, "A mensagem deve ter até 4096 caracteres.");
export const MAX_NOME_ANEXO = 255;
export function nomeAnexoCurto(nome: string | undefined): string | undefined {
  const t = nome?.trim();
  return t ? [...t].slice(0, MAX_NOME_ANEXO).join("") : undefined;
}
export const AgendarSchema = z.object({
  numeroId: z.string().min(1, "Escolha o número de envio."),
  texto: z.string().trim().max(4096, "A mensagem deve ter até 4096 caracteres."),
  agendadaPara: InstanteSchema,
  validaAte: InstanteSchema.optional(),
  tarefaId: z.string().min(1).optional(),
  leadId: z.string().min(1).optional(),
  pessoaId: z.string().min(1).optional(),
  atendimentoId: z.string().min(1).optional(),
  perguntarSeResponder: z.boolean().optional(),
  midiaUrl: z.string().min(1).max(500).optional(),
  documentoPropostaId: z.string().min(1).optional(),
  anexoNome: z.string().trim().max(MAX_NOME_ANEXO).optional(),
  chaveIdempotencia: ChaveIdempotenciaSchema.optional(),
}).superRefine((d, ctx) => {
  if (d.midiaUrl && d.documentoPropostaId) ctx.addIssue({ code: "custom", path: ["midiaUrl"], message: "Escolha só um anexo." });
  else if (!d.texto && !d.midiaUrl && !d.documentoPropostaId) ctx.addIssue({ code: "custom", path: ["texto"], message: "Escreva a mensagem." });
});

export function futuro(v: string, agora = new Date()): Date {
  const d = new Date(v);
  if (d.getTime() <= agora.getTime()) throw new ErroRegra(MSG_FUTURO);
  return d;
}

export function dataFutura(m: { validaAte: Date | null }, quando: Date) {
  if (m.validaAte && m.validaAte.getTime() <= quando.getTime()) throw new ErroRegra("A nova data passa da validade da mensagem.");
}

export const MOTIVO_AGUARDA_CONFIRMACAO = "aguarda_confirmacao_resposta";

export type AgendadaComPergunta = {
  origem: string;
  agendadaPara: Date | null;
  perguntarSeResponder: boolean;
  confirmadaAposRespostaEm: Date | null;
  criadaEm: Date;
};

export function respondeuDepoisDeAgendar(it: AgendadaComPergunta, ultimoInboundEm: Date | null | undefined): boolean {
  if (it.origem !== "HUMANO" || !it.agendadaPara || !it.perguntarSeResponder || !ultimoInboundEm) return false;
  return ultimoInboundEm.getTime() > (it.confirmadaAposRespostaEm ?? it.criadaEm).getTime();
}
