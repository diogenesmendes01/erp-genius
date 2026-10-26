import type { EtapaLead } from "@prisma/client";
import { COLUNAS_FUNIL, destinoDoArraste, type DestinoArraste } from "@/server/crm/etapas";
import { ETAPA_LABEL } from "@/lib/labels";

export const ETAPAS_BARRA: readonly EtapaLead[] = [
  "NOVO", "EM_ATENDIMENTO", "QUALIFICADO", "EXPERIMENTAL_AGENDADA",
  "EXPERIMENTAL_REALIZADA", "PROPOSTA", "AGUARDANDO_MATRICULA", "MATRICULADO",
];
export type SegmentoEtapa = { etapa: EtapaLead; estado: "feita" | "atual" | "futura"; tom: "marca" | "perigo" | "neutro" };
export function segmentosEtapa(atual: EtapaLead): SegmentoEtapa[] {
  const indice = ETAPAS_BARRA.indexOf(atual === "NO_SHOW" ? "EXPERIMENTAL_REALIZADA" : atual);
  return ETAPAS_BARRA.map((etapa, i) => ({
    etapa,
    estado: atual === "PERDIDO" || i > indice ? "futura" : i === indice ? "atual" : "feita",
    tom: atual === "PERDIDO" ? "neutro" : atual === "NO_SHOW" && i === indice ? "perigo" : "marca",
  }));
}
export function opcoesEtapa(atual: EtapaLead): { etapa: EtapaLead; rotulo: string; destino: DestinoArraste }[] {
  return COLUNAS_FUNIL.map(etapa => ({ etapa, rotulo: ETAPA_LABEL[etapa], destino: destinoDoArraste(atual, etapa) }));
}