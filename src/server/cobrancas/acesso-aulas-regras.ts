import { diasCivisDesde } from "./regua";

export const DIAS_RESTRICAO_AUTOMATICA = 30;

export interface CobrancaParaRestricao {
  status: string;
  vencimento: Date;
  saldo: number | null;
  valorNegociado: number;
  valorRecebido: number | null;
}

export function cobrancaGeraRestricaoAutomatica(cobranca: CobrancaParaRestricao, agora: Date, fuso: string): boolean {
  if (cobranca.status === "CANCELADA" || cobranca.status === "PAGO") return false;
  const saldo = cobranca.saldo ?? Math.max(0, cobranca.valorNegociado - (cobranca.valorRecebido ?? 0));
  if (saldo <= 0 || diasCivisDesde(agora, cobranca.vencimento, fuso) < DIAS_RESTRICAO_AUTOMATICA) return false;
  return true;
}

export function acessoEfetivoBloqueado(manual: boolean, automatico: boolean) {
  return manual || automatico;
}

export function permiteAulasRegulares(matricula: {
  status: string; acessoBloqueado: boolean; acessoBloqueioManual: boolean; acessoBloqueioAutomatico: boolean;
}) {
  return matricula.status === "ATIVA" && !matricula.acessoBloqueado
    && !matricula.acessoBloqueioManual && !matricula.acessoBloqueioAutomatico;
}
