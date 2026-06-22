import { z } from "zod";
import { Segmento, Temperatura, EtapaLead, MotivoPerda } from "@prisma/client";
import { dataOpcional, dataHoraOpcional } from "@/server/_shared/validacao";

// Lead — CRM (ver docs/08, docs/09). Telefone livre → normalizado p/ E.164 no servidor (doc 19 §4.3).
const telefoneOpcional = z.string().optional();

export const LeadSchema = z.object({
  nome: z.string().min(1, "Informe o nome"),
  telefoneE164: telefoneOpcional,
  paisId: z.string().optional(),
  segmento: z.nativeEnum(Segmento).default(Segmento.ADULTO),
  temperatura: z.nativeEnum(Temperatura).default(Temperatura.MORNO),
  b2b: z.boolean().optional().default(false),
  vendedorDonoId: z.string().optional(),
  origemCampanha: z.string().optional(),
  origemConjunto: z.string().optional(),
  origemAnuncio: z.string().optional(),
  origemPalavra: z.string().optional(),
  // valor da oportunidade (doc 09 §Ficha do Lead)
  valorPrevisto: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(0).nullable()).optional(),
  planoPrevisto: z.string().optional(),
  comissaoPrevista: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(0).nullable()).optional(),
});
export type LeadInput = z.input<typeof LeadSchema>;

export const ResumoSchema = z.object({
  interesse: z.string().optional(),
  objetivo: z.string().optional(),
  urgencia: z.string().optional(),
  orcamento: z.string().optional(),
  objecao: z.string().optional(),
  proximaAcao: z.string().optional(),
});
export type ResumoInput = z.input<typeof ResumoSchema>;

export const DatasSchema = z.object({
  proximoFollowUp: dataOpcional,
  // dataExperimental carrega HORA (alimenta a agenda da Home). Aceita datetime-local
  // para não descartar o horário já agendado (issue #16); date-only ainda funciona,
  // mas o front mantém a hora existente quando o usuário só ajusta a data.
  dataExperimental: dataHoraOpcional,
  dataProposta: dataOpcional,
});
export type DatasInput = z.input<typeof DatasSchema>;

export const InteracaoSchema = z.object({
  canal: z.string().optional(),
  nota: z.string().min(1, "Descreva a interação"),
});
export type InteracaoInput = z.input<typeof InteracaoSchema>;

export const PerdaSchema = z
  .object({
    motivoPerda: z.nativeEnum(MotivoPerda),
    observacao: z.string().optional(),
  })
  .refine((d) => d.motivoPerda !== MotivoPerda.OUTRO || !!d.observacao?.trim(), {
    message: "Observação obrigatória quando o motivo é Outro",
    path: ["observacao"],
  });
export type PerdaInput = z.input<typeof PerdaSchema>;

// Etapas que o usuário pode definir manualmente no Kanban (Fase 0).
// PERDIDO e MATRICULADO têm fluxo próprio (marcar perdido / converter em matrícula).
export const ETAPAS_MANUAIS: EtapaLead[] = [
  EtapaLead.NOVO,
  EtapaLead.EM_ATENDIMENTO,
  EtapaLead.QUALIFICADO,
  EtapaLead.EXPERIMENTAL_AGENDADA,
  EtapaLead.EXPERIMENTAL_REALIZADA,
  EtapaLead.PROPOSTA,
  EtapaLead.AGUARDANDO_MATRICULA,
];
