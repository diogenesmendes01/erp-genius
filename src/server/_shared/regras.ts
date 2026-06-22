import { EtapaLead } from "@prisma/client";
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

/**
 * Vencimento da 1ª mensalidade (regra de domínio do PO): 30 dias após o início
 * da PRIMEIRA AULA da turma, ajustado para o DIA de vencimento selecionado na
 * matrícula. Sem turma/data de início, cai para a referência informada
 * (`fallback`, normalmente a data de criação) + 30 dias, também ajustada ao dia.
 *
 * "Ajustado ao dia" = mantém o mês de (início + 30d) mas troca o dia para o
 * `diaVencimento`. Função pura (sem I/O) → testável.
 */
export function vencimentoPrimeiraMensalidade(
  diaVencimento: number,
  dataInicioAula: Date | null | undefined,
  fallback: Date = new Date(),
): { data: Date; competencia: string } {
  const base = dataInicioAula ?? fallback;
  const mais30 = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 30);
  const data = new Date(mais30.getFullYear(), mais30.getMonth(), diaVencimento);
  const competencia = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
  return { data, competencia };
}

/** O usuário pode mover o lead para esta etapa manualmente? (Perdido/Matriculado têm fluxo próprio.) */
export function ehEtapaManual(etapa: EtapaLead): boolean {
  return ETAPAS_MANUAIS.includes(etapa);
}

// ------------------------------------------------------------
// Lastro financeiro da ativação (issue #23).
// A ativação COM pagamento não pode presumir quitação integral: o valor
// recebido é alocado às cobranças na ordem dada e cada uma só vira PAGO se for
// integralmente coberta. Regra pura (sem I/O) → testável.
// ------------------------------------------------------------

/** Uma cobrança vista pela regra de alocação (só o que importa para distribuir o valor). */
export interface CobrancaParaAlocar {
  id: string;
  valorNegociado: number;
}

/** Resultado da alocação de uma cobrança. */
export interface AlocacaoCobranca {
  id: string;
  /** Quanto deste pagamento foi aplicado a esta cobrança. */
  valorRecebido: number;
  /** Saldo restante da cobrança (0 quando quitada). */
  saldo: number;
  /** Quitada integralmente? Só então pode ir para PAGO. */
  quitada: boolean;
}

/** Resultado completo da distribuição do valor recebido entre as cobranças. */
export interface ResultadoAlocacao {
  alocacoes: AlocacaoCobranca[];
  /** Soma dos valores negociados das cobranças informadas. */
  totalDevido: number;
  /** Sobra do pagamento após cobrir tudo (>= 0). */
  troco: number;
  /** Todas as cobranças foram integralmente quitadas? */
  quitouTudo: boolean;
}

/**
 * Distribui `valorRecebido` entre `cobrancas`, na ordem informada, sem presumir
 * quitação: cada cobrança só é marcada como `quitada` quando o valor alocado
 * cobre todo o seu `valorNegociado`. Pagamentos parciais ficam com saldo > 0
 * (continuam PENDENTES no chamador). Garante o critério: "o backend valida se o
 * valor recebido cobre taxa/mensalidade antes de marcar a cobrança como paga".
 */
export function alocarPagamento(
  valorRecebido: number,
  cobrancas: CobrancaParaAlocar[],
): ResultadoAlocacao {
  let restante = Math.max(0, valorRecebido);
  let totalDevido = 0;
  const alocacoes: AlocacaoCobranca[] = cobrancas.map((c) => {
    totalDevido += c.valorNegociado;
    const aplicado = Math.min(restante, c.valorNegociado);
    restante -= aplicado;
    const saldo = c.valorNegociado - aplicado;
    return { id: c.id, valorRecebido: aplicado, saldo, quitada: saldo <= 0 };
  });
  return {
    alocacoes,
    totalDevido,
    troco: restante,
    quitouTudo: alocacoes.every((a) => a.quitada),
  };
}
