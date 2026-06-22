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

/** O usuário pode mover o lead para esta etapa manualmente? (Perdido/Matriculado têm fluxo próprio.) */
export function ehEtapaManual(etapa: EtapaLead): boolean {
  return ETAPAS_MANUAIS.includes(etapa);
}
