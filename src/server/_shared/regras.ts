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

/**
 * O check-in da experimental só vale enquanto o lead está na etapa que tem
 * uma experimental AGENDADA — protege contra check-in repetido / fora de ordem
 * (lead já Realizado, No-show, Perdido, Matriculado, etc.). Ver docs/09 §Check-in.
 */
export function podeCheckinExperimental(etapa: EtapaLead): boolean {
  return etapa === EtapaLead.EXPERIMENTAL_AGENDADA;
}

/**
 * O professor está no escopo desta experimental? (associação professor↔lead).
 * O vínculo é gravado no event log como `ExperimentalAtribuida` — não há FK no V0
 * (pendência de modelagem, docs/15). `professorAtribuidoId` = professor da última
 * atribuição (null = ainda sem vínculo → fora do escopo de qualquer professor).
 */
export function professorNoEscopoExperimental(
  professorAtribuidoId: string | null | undefined,
  professorId: string,
): boolean {
  return !!professorAtribuidoId && professorAtribuidoId === professorId;
}
