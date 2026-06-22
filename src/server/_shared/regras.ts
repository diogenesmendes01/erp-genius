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

// ── Máquina de estados do lead (transições MANUAIS) ─────────────────────────
// Doc 10 §1 define quem dispara cada transição. O arraste no Kanban (moverEtapa)
// só cobre o trecho que é responsabilidade do VENDEDOR e nunca pode pular para
// etapas que dependem de evento (Exp. Realizada, Proposta, Aguardando Matrícula,
// Matriculado) nem para as saídas paralelas (Perdido/No-show — fluxo próprio).
//
// Cada chave é a etapa ATUAL; o conjunto são os destinos manuais permitidos a
// partir dela. Avanço passo-a-passo no funil + correções (voltar uma casa /
// reabrir um lead encerrado pelo evento). Tudo o que não estiver no mapa é salto
// inválido e é recusado no servidor, mesmo que o client envie.
const TRANSICOES_MANUAIS: Partial<Record<EtapaLead, EtapaLead[]>> = {
  [EtapaLead.NOVO]: [EtapaLead.EM_ATENDIMENTO],
  [EtapaLead.EM_ATENDIMENTO]: [EtapaLead.NOVO, EtapaLead.QUALIFICADO],
  [EtapaLead.QUALIFICADO]: [EtapaLead.EM_ATENDIMENTO, EtapaLead.EXPERIMENTAL_AGENDADA],
  // Reagendar a experimental volta a este passo; antes da experimental ainda
  // dá para corrigir a qualificação.
  [EtapaLead.EXPERIMENTAL_AGENDADA]: [EtapaLead.QUALIFICADO],
  // Etapas geradas por evento permitem RETOMAR o trabalho manual do vendedor
  // (ex.: pós no-show/experimental, reagendar; pós proposta, voltar a qualificar),
  // mas nunca avançar para uma etapa de evento manualmente.
  [EtapaLead.EXPERIMENTAL_REALIZADA]: [EtapaLead.QUALIFICADO, EtapaLead.EXPERIMENTAL_AGENDADA],
  [EtapaLead.NO_SHOW]: [EtapaLead.QUALIFICADO, EtapaLead.EXPERIMENTAL_AGENDADA],
  [EtapaLead.PROPOSTA]: [EtapaLead.QUALIFICADO, EtapaLead.EXPERIMENTAL_AGENDADA],
  [EtapaLead.AGUARDANDO_MATRICULA]: [EtapaLead.PROPOSTA],
};

/**
 * Uma transição MANUAL de `origem` → `destino` é permitida?
 *
 * Regras (puras, sem I/O — fonte única e testável):
 *  - destino precisa ser uma etapa manual (`ETAPAS_MANUAIS`);
 *  - `origem === destino` é no-op (permitido; o chamador trata como nada a fazer);
 *  - caso contrário, o par precisa existir na máquina de estados.
 *
 * Saltos para etapas de evento (Proposta, Aguardando Matrícula, etc.) ou para as
 * saídas paralelas (Perdido/Matriculado) são SEMPRE recusados aqui.
 */
export function transicaoManualPermitida(origem: EtapaLead, destino: EtapaLead): boolean {
  if (origem === destino) return true;
  if (!ehEtapaManual(destino)) return false;
  return TRANSICOES_MANUAIS[origem]?.includes(destino) ?? false;
}
