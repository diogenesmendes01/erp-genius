import { diasCivisDesde } from "./regua";

export const DIAS_RESTRICAO_AUTOMATICA = 30;

export interface CobrancaParaRestricao {
  status: string;
  vencimento: Date;
  saldo: number | null;
  valorNegociado: number;
  valorRecebido: number | null;
}

/**
 * A pausa dos lembretes não equivale à regularização da dívida nem suspende D+30.
 * Os dias de atraso contam no calendário da escola (`fuso`, Q176), não no relógio do servidor.
 */
export function cobrancaGeraRestricaoAutomatica(cobranca: CobrancaParaRestricao, agora: Date, fuso: string): boolean {
  if (cobranca.status === "CANCELADA" || cobranca.status === "PAGO") return false;
  const saldo = cobranca.saldo ?? Math.max(0, cobranca.valorNegociado - (cobranca.valorRecebido ?? 0));
  if (saldo <= 0 || diasCivisDesde(agora, cobranca.vencimento, fuso) < DIAS_RESTRICAO_AUTOMATICA) return false;
  return true;
}

/** Liquidar a dívida não revoga uma decisão manual independente. */
export function acessoEfetivoBloqueado(manual: boolean, automatico: boolean) {
  return manual || automatico;
}

/** A ausência de restrição financeira não ativa uma matrícula pausada ou encerrada. */
export function permiteAulasRegulares(matricula: {
  status: string; acessoBloqueado: boolean; acessoBloqueioManual: boolean; acessoBloqueioAutomatico: boolean;
}) {
  return matricula.status === "ATIVA" && !matricula.acessoBloqueado
    && !matricula.acessoBloqueioManual && !matricula.acessoBloqueioAutomatico;
}
