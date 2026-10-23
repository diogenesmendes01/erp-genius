"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";

type ItemComPrazo = Pick<ItemListaInbox, "grupo" | "status" | "prazoRespostaEm">;

export function prazoEstourado(i: ItemComPrazo, agora: number): boolean {
  return !i.grupo && i.status !== "ENCERRADO" && !!i.prazoRespostaEm && new Date(i.prazoRespostaEm).getTime() < agora;
}

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

export function esperaAteProximo(proximo: number | null, agora: number): number | null {
  return proximo === null ? null : Math.min(Math.max(proximo - agora + 1, 0), TETO_TIMER_MS);
}

/** Snapshot estável entre vencimentos; assinar/desassinar é o ciclo de vida do único timer. */
function criarRelogioDosPrazos(itens: ItemListaInbox[]) {
  let agora = Date.now();
  return {
    ler: () => agora,
    assinar(notificar: () => void) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const armar = () => {
        const referencia = Date.now();
        // A regra é estrita (<): o prazo igual a agora ainda precisa acordar em +1 ms.
        const espera = esperaAteProximo(proximoEstouroEm(itens, referencia - 1), referencia);
        if (espera === null) return;
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

export function useAgoraDosPrazos(itens: ItemListaInbox[]): number {
  // Uma lista SSE nova usa o relógio atual já no primeiro render e substitui a assinatura anterior.
  const relogio = useMemo(() => criarRelogioDosPrazos(itens), [itens]);
  return useSyncExternalStore(relogio.assinar, relogio.ler, relogio.ler);
}
