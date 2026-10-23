"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";

export { prazoEstourado } from "./prazo-atendimento";

/**
 * @deprecated Legado do relógio que atualizava apenas no vencimento; mantido para compatibilidade e testes históricos.
 * Não tem consumidor de produção. O relógio atual usa proximaMudancaVisualEm.
 */
export function proximoEstouroEm(itens: ItemListaInbox[], agora: number): number | null {
  let proximo: number | null = null;
  for (const i of itens) {
    if (i.grupo || i.status === "ENCERRADO" || !i.prazoRespostaEm) continue;
    const prazo = new Date(i.prazoRespostaEm).getTime();
    if (prazo > agora && (proximo === null || prazo < proximo)) proximo = prazo;
  }
  return proximo;
}

export const TETO_TIMER_MS = 2_147_483_647;

/**
 * @deprecated Legado do vencimento +1ms; mantido para compatibilidade e testes históricos.
 * O loop atual calcula a espera a partir do instante visual já estrito, sem acrescentar outro 1ms.
 */
export function esperaAteProximo(proximo: number | null, agora: number): number | null {
  return proximo === null ? null : Math.min(Math.max(proximo - agora + 1, 0), TETO_TIMER_MS);
}

/**
 * Uma assinatura mantém um único timer local, sem rede. Enquanto houver prazo vencido,
 * ele atualiza o texto em cada próxima fronteira de minuto; desmontar cancela a espera.
 */
function criarRelogioDosPrazos(itens: ItemListaInbox[], inicial: number) {
  let agora = typeof window === "undefined" ? inicial : Date.now();
  return {
    ler: () => agora,
    assinar(notificar: () => void) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const armar = () => {
        const referencia = Date.now();
        const proximo = proximaMudancaVisualEm(itens, referencia);
        if (proximo === null) return;
        const espera = Math.min(proximo - referencia, TETO_TIMER_MS);
        timer = setTimeout(() => {
          agora = Date.now();
          notificar();
          armar();
        }, espera);
      };
      agora = Date.now();
      armar();
      return () => { if (timer !== undefined) clearTimeout(timer); };
    },
  };
}

export function useAgoraDosPrazos(itens: ItemListaInbox[], agoraInicial?: number): number {
  // Uma lista SSE nova usa o relógio atual já no primeiro render e substitui a assinatura anterior.
  const ssr = typeof agoraInicial === "number" && Number.isFinite(new Date(agoraInicial).getTime()) ? agoraInicial : 0;
  const relogio = useMemo(() => criarRelogioDosPrazos(itens, ssr), [itens, ssr]);
  return useSyncExternalStore(relogio.assinar, relogio.ler, () => ssr);
}

/** Próximo instante que muda o badge: vencimento estrito ou minuto visível seguinte. */
export function proximaMudancaVisualEm(itens: ItemListaInbox[], agora: number): number | null {
  let proxima: number | null = null;
  for (const item of itens) {
    if (item.grupo || item.status === "ENCERRADO" || !item.prazoRespostaEm) continue;
    const prazo = new Date(item.prazoRespostaEm).getTime();
    if (!Number.isFinite(prazo)) continue;
    // O primeiro minuto já é mostrado desde prazo+1ms: prazo+60s não muda texto/cor.
    const instante = prazo >= agora ? prazo + 1 : prazo + Math.max(2, Math.floor((agora - prazo) / 60_000) + 1) * 60_000;
    if (proxima === null || instante < proxima) proxima = instante;
  }
  return proxima;
}
