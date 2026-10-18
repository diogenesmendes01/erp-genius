import type { EtapaLead } from "@prisma/client";
import { ETAPAS_ARIA, type ConfigAria } from "../config-schema";
import type { MotivoHandoff, SaidaModelo } from "./tipos";

const MIN_TROCAS_SEM_AVANCO = 4;

function simplificar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Primeiro gatilho determinístico de handoff que dispara, ou null. Recusa e saída inválida sempre valem. */
export function gatilhoDeHandoff(i: {
  saida: SaidaModelo | null;
  recusa: boolean;
  ultimaFala: string;
  etapa: EtapaLead | null;
  valorPrevisto: number | null;
  trocasSemAvanco: number;
  config: ConfigAria;
}): MotivoHandoff | null {
  const { saida, config } = i;
  const g = config.handoff.gatilhos;
  if (i.recusa) return "RECUSA";
  if (!saida) return "ERRO_PROVEDOR";
  if (g.pedidoHumano && saida.handoff?.motivo === "PEDIDO_HUMANO") return "PEDIDO_HUMANO";
  if (g.palavrasChave) {
    const fala = simplificar(i.ultimaFala);
    if (config.handoff.palavrasChave.some((p) => fala.includes(simplificar(p)))) return "PALAVRA_CHAVE";
  }
  if (g.humor && saida.humor === "IRRITADO") return "HUMOR";
  if (g.confiancaBaixa && saida.confianca < config.confianca.transfereAbaixoDe) return "CONFIANCA";
  const corte = config.handoff.etapaGatilho;
  if (g.etapa && corte && i.etapa) {
    const atual = ETAPAS_ARIA.indexOf(i.etapa);
    if (atual >= 0 && atual >= ETAPAS_ARIA.indexOf(corte)) return "ETAPA";
  }
  const limite = config.handoff.valorGatilho;
  if (g.valor && limite !== undefined && i.valorPrevisto !== null && i.valorPrevisto > limite) return "VALOR";
  if (g.semAvanco && i.trocasSemAvanco >= MIN_TROCAS_SEM_AVANCO) return "SEM_AVANCO";
  return null;
}
