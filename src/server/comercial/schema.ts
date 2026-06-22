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

// Agendamento da experimental (doc 09 §Ficha do Lead / pipeline). Captura também
// o professor responsável (FK escopo — Issue #13). professorId opcional: pode-se
// agendar sem definir o professor e atribuir/remanejar depois. A UI envia "" na
// opção "Definir depois"; normalizamos vazio → null para diferenciar "limpar o
// responsável" de "campo ausente".
export const AgendarExperimentalSchema = z.object({
  dataISO: z.string().min(1, "Informe a data/hora da experimental"),
  professorId: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.string().nullable(),
  ).optional(),
});
export type AgendarExperimentalInput = z.input<typeof AgendarExperimentalSchema>;

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

// Etapas que o vendedor pode definir manualmente no Kanban (Fase 0).
//
// As demais etapas do funil são geradas por EVENTOS DE DOMÍNIO, não por arraste:
//   - EXPERIMENTAL_REALIZADA / NO_SHOW → check-in do professor (checkinExperimental)
//   - PROPOSTA                          → envio da proposta (enviarProposta)
//   - AGUARDANDO_MATRICULA              → handoff para a máquina da matrícula (doc 08)
//   - MATRICULADO                       → matrícula ativada (fluxo próprio)
//   - PERDIDO                           → marcar perdido (com motivo)
// Por isso elas NÃO entram aqui: mesmo que o client envie, o backend recusa (ver acoes.moverEtapa).
//
// Mover manualmente ainda respeita a máquina de estados (origem→destino) — ver
// transicaoManualPermitida() em @/server/_shared/regras.
export const ETAPAS_MANUAIS: EtapaLead[] = [
  EtapaLead.NOVO,
  EtapaLead.EM_ATENDIMENTO,
  EtapaLead.QUALIFICADO,
  EtapaLead.EXPERIMENTAL_AGENDADA,
];

// Tipos de evento (agregado Lead) que mudam a etapa do funil. Fonte única de
// verdade para projetar `etapaDesde` de forma confiável (issue #15): a etapa muda
// por ação manual (EtapaAlterada) e também por ações específicas que avançam o
// funil. O fluxo de matrícula também emite EtapaAlterada no agregado Lead.
export const TIPOS_MUDAM_ETAPA: string[] = [
  "EtapaAlterada",
  "ExperimentalAgendada",
  "ExperimentalRealizada",
  "NoShow",
  "PropostaEnviada",
  "LeadPerdido",
];
