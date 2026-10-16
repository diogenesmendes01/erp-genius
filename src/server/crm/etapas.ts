import { EtapaLead } from "@prisma/client";
import { transicaoManualPermitida } from "@/server/_shared/regras";

// Q8: com funis configuráveis, este mapa passa a ler EtapaFunil.tipoSemantico.

export const COLUNAS_FUNIL: readonly EtapaLead[] = [
  EtapaLead.NOVO,
  EtapaLead.EM_ATENDIMENTO,
  EtapaLead.QUALIFICADO,
  EtapaLead.EXPERIMENTAL_AGENDADA,
  EtapaLead.EXPERIMENTAL_REALIZADA,
  EtapaLead.NO_SHOW,
  EtapaLead.PROPOSTA,
  EtapaLead.AGUARDANDO_MATRICULA,
  EtapaLead.MATRICULADO,
  EtapaLead.PERDIDO,
];

export const COLUNAS_RECOLHIDAS: readonly EtapaLead[] = [EtapaLead.MATRICULADO, EtapaLead.PERDIDO];

// "nenhum": o card voltou para a própria coluna. A UI não abre diálogo nem
// chama o servidor, e o servidor não grava Evento de etapa sem mudança.
export type DestinoArraste =
  | { tipo: "nenhum" }
  | { tipo: "mover" }
  | { tipo: "acao"; acao: "agendarExperimental" | "marcarPerdido" | "prepararContratacao" | "enviarProposta" }
  | { tipo: "recusar"; motivo: string };

export function destinoDoArraste(origem: EtapaLead, destino: EtapaLead): DestinoArraste {
  if (origem === destino) return { tipo: "nenhum" };
  if (origem === EtapaLead.MATRICULADO || origem === EtapaLead.PERDIDO) {
    return { tipo: "recusar", motivo: "Oportunidade encerrada não volta ao funil." };
  }
  if (destino === EtapaLead.PERDIDO) return { tipo: "acao", acao: "marcarPerdido" };
  if (destino === EtapaLead.MATRICULADO || destino === EtapaLead.AGUARDANDO_MATRICULA) {
    return { tipo: "acao", acao: "prepararContratacao" };
  }
  if (destino === EtapaLead.PROPOSTA) return { tipo: "acao", acao: "enviarProposta" };
  if (destino === EtapaLead.EXPERIMENTAL_REALIZADA || destino === EtapaLead.NO_SHOW) {
    return { tipo: "recusar", motivo: "Esta etapa é registrada pelo check-in do professor." };
  }
  if (transicaoManualPermitida(origem, destino)) {
    return destino === EtapaLead.EXPERIMENTAL_AGENDADA
      ? { tipo: "acao", acao: "agendarExperimental" }
      : { tipo: "mover" };
  }
  return { tipo: "recusar", motivo: "Avance uma etapa por vez." };
}
