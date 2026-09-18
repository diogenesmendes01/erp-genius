export type VencimentoVisivel =
  | { estado: "CONFIRMADO"; dataCivil: string; fuso: string; origem: "EMISSAO_ENTRADA" | "EMISSAO_CONTINUIDADE" | "FECHAMENTO_HORAS" }
  | { estado: "A_CONFERIR"; motivo: string };

/** Formata a data civil entregue pelo servidor sem reinterpretar o instante no navegador. */
export function rotuloVencimento(vencimento: VencimentoVisivel): string {
  if (vencimento.estado !== "CONFIRMADO") return `Vencimento a conferir: ${vencimento.motivo}`;
  const [ano, mes, dia] = vencimento.dataCivil.split("-");
  return `vence ${dia}/${mes}/${ano} · referência ${vencimento.fuso}`;
}
