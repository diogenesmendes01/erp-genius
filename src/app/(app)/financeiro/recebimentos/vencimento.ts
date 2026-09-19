export type VencimentoVisivel =
  | { estado: "CONFIRMADO"; dataCivil: string; fuso: string | null; origem: "EMISSAO_ENTRADA" | "EMISSAO_CONTINUIDADE" | "FECHAMENTO_HORAS" | "M01_HISTORICO" | "ADITIVO_VENCIMENTO" | "ACERTO_TAXA_ADITIVO" | "RETOMADA_REPROGRAMADA" }
  | { estado: "A_CONFERIR"; motivo: string };

/** Formata a data civil entregue pelo servidor sem reinterpretar o instante no navegador. */
export function rotuloVencimento(vencimento: VencimentoVisivel): string {
  if (vencimento.estado !== "CONFIRMADO") return `Vencimento a conferir: ${vencimento.motivo}`;
  const [ano, mes, dia] = vencimento.dataCivil.split("-");
  const referencia = vencimento.fuso ? `referência ${vencimento.fuso}` : `origem ${vencimento.origem}`;
  return `vence ${dia}/${mes}/${ano} · ${referencia}`;
}
