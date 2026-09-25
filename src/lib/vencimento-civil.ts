export type VencimentoVisivel =
  | { estado: "CONFIRMADO"; dataCivil: string; fuso: string | null; origem: "EMISSAO_ENTRADA" | "EMISSAO_CONTINUIDADE" | "FECHAMENTO_HORAS" | "M01_HISTORICO" | "ADITIVO_VENCIMENTO" | "ACERTO_TAXA_ADITIVO" | "RETOMADA_REPROGRAMADA" }
  | { estado: "A_CONFERIR"; motivo: string };

type OrigemVencimento = Extract<VencimentoVisivel, { estado: "CONFIRMADO" }>["origem"];

/** Origem do vencimento em texto de operação (E5: "M01_HISTORICO" aparecia cru na tela). */
export const ORIGEM_VENCIMENTO_LABEL: Record<OrigemVencimento, string> = {
  EMISSAO_ENTRADA: "emissão da entrada",
  EMISSAO_CONTINUIDADE: "continuidade mensal",
  FECHAMENTO_HORAS: "fechamento de horas",
  M01_HISTORICO: "histórico da migração",
  ADITIVO_VENCIMENTO: "aditivo de vencimento",
  ACERTO_TAXA_ADITIVO: "acerto de taxa por aditivo",
  RETOMADA_REPROGRAMADA: "retomada reprogramada",
};

/** Formata a data civil entregue pelo servidor sem reinterpretar o instante no navegador. */
export function rotuloVencimento(vencimento: VencimentoVisivel): string {
  if (vencimento.estado !== "CONFIRMADO") return `Vencimento a conferir: ${vencimento.motivo}`;
  const [ano, mes, dia] = vencimento.dataCivil.split("-");
  const referencia = vencimento.fuso ? `referência ${vencimento.fuso}` : `origem: ${ORIGEM_VENCIMENTO_LABEL[vencimento.origem] ?? vencimento.origem}`;
  return `vence ${dia}/${mes}/${ano} · ${referencia}`;
}

/** Datas da régua são dias civis relativos ao vencimento, não instantes do navegador. */
export function dataCivilComDeslocamento(vencimento: VencimentoVisivel, dias: number): string | null {
  if (vencimento.estado !== "CONFIRMADO") return null;
  const data = new Date(`${vencimento.dataCivil}T12:00:00.000Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  const [ano, mes, dia] = data.toISOString().slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}
