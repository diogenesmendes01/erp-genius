import { EtapaLead, TipoAjuste } from "@prisma/client";
import { ETAPAS_MANUAIS } from "@/server/comercial/schema";

// Regras de negócio PURAS (sem I/O) — fonte única e testável (ver docs/14).

/** Comissão = % da taxa de matrícula (doc 10 §3). */
export function calcularComissao(taxa: number, percentual: number): number {
  return (taxa * percentual) / 100;
}

/**
 * Vencimento da mensalidade no dia escolhido, no mês atual + offset (0 = este mês).
 * `agora` injetável para testes determinísticos.
 */
export function vencimentoMensalidade(
  dia: number,
  offset: number,
  agora: Date = new Date(),
): { data: Date; competencia: string } {
  const d = new Date(agora.getFullYear(), agora.getMonth() + offset, dia);
  const competencia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { data: d, competencia };
}

/** O usuário pode mover o lead para esta etapa manualmente? (Perdido/Matriculado têm fluxo próprio.) */
export function ehEtapaManual(etapa: EtapaLead): boolean {
  return ETAPAS_MANUAIS.includes(etapa);
}

// ── Ajustes financeiros (doc 09 §Renegociação · doc 10 §2/§3) ────────────────
// Um ajuste é, por padrão, uma REDUÇÃO de valor (desconto, bolsa, renegociação,
// perdão). Aumentar o valor cobrado é uma operação distinta e intencional, só
// permitida no tipo ALTERACAO_VALOR ("alterar valor") — nunca como efeito
// colateral de um desconto.

/** Único tipo de ajuste que pode AUMENTAR o valor cobrado. */
export const TIPO_AJUSTE_PERMITE_AUMENTO: TipoAjuste = TipoAjuste.ALTERACAO_VALOR;

/** O `valorPara` representa um aumento sobre o valor atual? */
export function ehAumento(valorDe: number, valorPara: number): boolean {
  return valorPara > valorDe;
}

/** O aumento é permitido para este tipo de ajuste? (só ALTERACAO_VALOR aumenta.) */
export function aumentoPermitido(tipo: TipoAjuste): boolean {
  return tipo === TIPO_AJUSTE_PERMITE_AUMENTO;
}

/**
 * Valida a direção do ajuste em relação ao valor atual.
 * - Tipos de redução (desconto/bolsa/renegociação/perdão): `valorPara` <= `valorDe`.
 * - ALTERACAO_VALOR: livre (pode aumentar ou reduzir).
 * Retorna `null` quando válido, ou a mensagem de erro.
 */
export function validarDirecaoAjuste(
  tipo: TipoAjuste,
  valorDe: number,
  valorPara: number,
): string | null {
  if (ehAumento(valorDe, valorPara) && !aumentoPermitido(tipo)) {
    return "Este ajuste não pode aumentar o valor cobrado. Use 'Alterar valor' para aumentos.";
  }
  return null;
}

/** Percentual de desconto (0 quando não há redução ou valor base zero). */
export function descontoPercentual(valorDe: number, valorPara: number): number {
  if (valorDe <= 0) return 0;
  const pct = ((valorDe - valorPara) / valorDe) * 100;
  return pct > 0 ? pct : 0;
}

/**
 * Um pedido de desconto precisa de aprovação?
 * Regra (doc 10 §2): só Financeiro/Admin aplicam sem limite. Para os demais
 * (ex.: Vendedor), `limiteDescontoPct = null` NÃO significa ilimitado — significa
 * "sem autonomia" (limite efetivo 0): qualquer desconto vai para aprovação.
 * Aumentos (descontoPct <= 0) nunca exigem aprovação por limite.
 */
export function precisaAprovacaoDesconto(params: {
  podeAplicarSemLimite: boolean;
  limiteDescontoPct: number | null;
  descontoPct: number;
}): boolean {
  const { podeAplicarSemLimite, limiteDescontoPct, descontoPct } = params;
  if (podeAplicarSemLimite) return false;
  if (descontoPct <= 0) return false;
  const limiteEfetivo = limiteDescontoPct ?? 0; // null = sem autonomia, não ilimitado
  return descontoPct > limiteEfetivo;
}
