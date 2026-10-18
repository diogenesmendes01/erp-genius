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
  /** null = ainda sem setor; vai para a triagem (Task 23), não bloqueia aqui. */
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
  /** Rajada: chegou fala mais nova do cliente no atendimento; o turno dela responde ao conjunto. */
  | "FALA_SUPERADA";

// Texto puro, ou mídia que pode carregar legenda (a legenda vira o texto do turno).
const TIPOS_COM_TEXTO: ReadonlySet<TipoMensagem> = new Set(["TEXTO", "IMAGEM", "VIDEO", "DOCUMENTO"]);

/** Leis de código: primeiro motivo que impede a Aria de atuar, ou null. GRUPO vence todas. */
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

/** Orçamento estourado com SO_SUGERIR: a Aria atua, mas só sugere (nada sai). */
export function forcarSoSugerir(s: SituacaoGuarda): boolean {
  return s.orcamento === "ESTOURADO" && s.acaoOrcamento === "SO_SUGERIR";
}
