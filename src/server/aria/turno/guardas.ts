import type {
  AcaoOrcamentoIA,
  EstadoPolitica,
  FinalidadeAtendimentoWhatsApp,
  TipoMensagem,
} from "@prisma/client";

export interface SituacaoGuarda {
  estado: EstadoPolitica;
  pausadaGlobal: boolean;
  orcamento: "OK" | "ALERTA" | "ESTOURADO";
  acaoOrcamento: AcaoOrcamentoIA;
  conversaDeGrupo: boolean;
  finalidade: FinalidadeAtendimentoWhatsApp | null;
  iaPausadaEm: Date | null;
  atendimentoEncerrado: boolean;
  contatoOptOut: boolean;
  numeroComDono: boolean;
  mensagemTipo: TipoMensagem;
}

export type MotivoBloqueio =
  | "DESLIGADA"
  | "PAUSADA"
  | "ORCAMENTO"
  | "GRUPO"
  | "PAUSADA_NO_ATENDIMENTO"
  | "ENCERRADO"
  | "OPT_OUT"
  | "OUTRO_SETOR"
  | "LINHA_COM_DONO"
  | "SEM_TEXTO"
  | "FALA_SUPERADA";

export const TIPOS_COM_TEXTO: ReadonlySet<TipoMensagem> = new Set(["TEXTO", "IMAGEM", "VIDEO", "DOCUMENTO"]);

export function motivoParaNaoAtuar(s: SituacaoGuarda): MotivoBloqueio | null {
  if (s.conversaDeGrupo) return "GRUPO";
  if (s.estado === "DESLIGADA") return "DESLIGADA";
  if (s.pausadaGlobal) return "PAUSADA";
  if (s.orcamento === "ESTOURADO" && s.acaoOrcamento === "PAUSAR") return "ORCAMENTO";
  if (s.iaPausadaEm) return "PAUSADA_NO_ATENDIMENTO";
  if (s.atendimentoEncerrado) return "ENCERRADO";
  if (s.contatoOptOut) return "OPT_OUT";
  if (s.finalidade !== null && s.finalidade !== "COMERCIAL") return "OUTRO_SETOR";
  if (s.numeroComDono) return "LINHA_COM_DONO";
  if (!TIPOS_COM_TEXTO.has(s.mensagemTipo)) return "SEM_TEXTO";
  return null;
}

export function forcarSoSugerir(s: SituacaoGuarda): boolean {
  return s.orcamento === "ESTOURADO" && s.acaoOrcamento === "SO_SUGERIR";
}
