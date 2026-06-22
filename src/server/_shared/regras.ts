import { EtapaLead } from "@prisma/client";
import { ETAPAS_MANUAIS } from "@/server/comercial/schema";
import { ErroRegra } from "./sessao";

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

/** Resultado puro do cálculo de um pagamento (parcial/total/excedente). */
export interface ResultadoPagamento {
  /** Total acumulado já recebido na cobrança (recebidos anteriores + valor atual). */
  recebidoTotal: number;
  /** Saldo devedor restante (nunca negativo). */
  saldo: number;
  /** Verdadeiro quando o acumulado cobre o valor devido. */
  quitada: boolean;
  /** Valor recebido acima do negociado (>= 0). Crédito/excedente explícito. */
  excedente: number;
}

/**
 * Acumula um pagamento sobre o que já foi recebido e calcula saldo/quitação.
 *
 * Regras (doc 09 §Financeiro, issue #10):
 * - o valor atual SOMA ao já recebido (parciais sucessivos acumulam corretamente);
 * - o saldo é calculado pelo ACUMULADO, não só pelo valor atual;
 * - a cobrança só quita quando o acumulado cobre o valor negociado;
 * - recebimento acima do negociado só é aceito com `permitirExcedente`; caso
 *   contrário lança `ErroRegra` para ser bloqueado pela camada de ação.
 *
 * Função PURA (sem I/O) — fonte única e testável (ver docs/14).
 */
export function acumularPagamento(
  jaRecebido: number,
  valorNegociado: number,
  valorAtual: number,
  permitirExcedente = false,
): ResultadoPagamento {
  if (valorAtual <= 0) {
    throw new ErroRegra("O valor recebido deve ser maior que zero.");
  }
  const recebidoTotal = jaRecebido + valorAtual;
  const excedente = Math.max(0, recebidoTotal - valorNegociado);
  if (excedente > 0 && !permitirExcedente) {
    throw new ErroRegra(
      "Valor recebido excede o saldo devido. Marque o excedente como crédito para continuar.",
    );
  }
  const saldo = Math.max(0, valorNegociado - recebidoTotal);
  return { recebidoTotal, saldo, quitada: saldo <= 0, excedente };
}
