import { z } from "zod";
import { Segmento, Temperatura, EtapaLead, MotivoPerda, OrigemCanal } from "@prisma/client";
import { dataOpcional, dataHoraOpcional, ChaveIdempotenciaSchema } from "@/server/_shared/validacao";
import { parseMoeda } from "@/lib/dinheiro";
import { PrevisaoOportunidadeSchema } from "./previsao-schema";

const telefoneOpcional = z.string().optional();

function valorMonetarioOpcional(v: unknown) {
  if (v === "" || v == null) return null;
  if (typeof v === "number") return v;
  return parseMoeda(String(v)) ?? NaN;
}

export const LeadSchema = z.object({
  nome: z.string().min(1, "Informe o nome"),
  telefoneE164: telefoneOpcional,
  paisId: z.string().optional(),
  segmento: z.nativeEnum(Segmento).default(Segmento.ADULTO),
  temperatura: z.nativeEnum(Temperatura).default(Temperatura.MORNO),
  b2b: z.boolean().optional().default(false),
  vendedorDonoId: z.string().optional(),
  pessoaId: z.string().optional(),
  email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  origemCanal: z.nativeEnum(OrigemCanal).optional(),
  empresaId: z.string().optional(),
  criarEmpresa: z.boolean().optional().default(false),
  origemCampanha: z.string().optional(),
  origemConjunto: z.string().optional(),
  origemAnuncio: z.string().optional(),
  origemPalavra: z.string().optional(),
  valorPrevisto: z.preprocess(valorMonetarioOpcional, z.number().min(0).nullable()).optional(),
  planoPrevisto: z.string().optional(),
  comissaoPrevista: z.preprocess(valorMonetarioOpcional, z.number().min(0).nullable()).optional(),
});
export type LeadInput = z.input<typeof LeadSchema>;
export const EditarLeadSchema = LeadSchema.extend(PrevisaoOportunidadeSchema.shape);
export type EditarLeadInput = z.input<typeof EditarLeadSchema>;
export const CriarLeadSchema = LeadSchema.extend({ chaveIdempotencia: ChaveIdempotenciaSchema.optional() });
export type CriarLeadInput = z.input<typeof CriarLeadSchema>;

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
  dataExperimental: dataHoraOpcional,
  dataProposta: dataOpcional,
});
export type DatasInput = z.input<typeof DatasSchema> & { fusoDataExperimental?: string };

export const AgendarExperimentalSchema = z.object({
  dataISO: z.string().min(1, "Informe a data/hora da experimental").optional(),
  dataLocal: z.string().min(1, "Informe a data/hora da experimental").optional(),
  fuso: z.string().optional(),
  professorId: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.string().nullable(),
  ).optional(),
}).refine((d) => !!d.dataISO || !!d.dataLocal, { message: "Informe a data/hora da experimental", path: ["dataISO"] });
export type AgendarExperimentalInput = z.input<typeof AgendarExperimentalSchema>;

export const InteracaoSchema = z.object({
  canal: z.string().optional(),
  nota: z.string().min(1, "Descreva a interação"),
});
export type InteracaoInput = z.input<typeof InteracaoSchema>;

export const NotaInternaSchema = z.object({
  nota: z.string().trim().min(1, "Escreva a nota.").max(2000, "Nota longa demais (máx. 2000)."),
});
export type NotaInternaInput = z.input<typeof NotaInternaSchema>;

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

export const ETAPAS_MANUAIS: EtapaLead[] = [
  EtapaLead.NOVO,
  EtapaLead.EM_ATENDIMENTO,
  EtapaLead.QUALIFICADO,
  EtapaLead.EXPERIMENTAL_AGENDADA,
];

export const TIPOS_MUDAM_ETAPA: string[] = [
  "EtapaAlterada",
  "ExperimentalAgendada",
  "ExperimentalRealizada",
  "NoShow",
  "PropostaEnviada",
  "LeadPerdido",
];
