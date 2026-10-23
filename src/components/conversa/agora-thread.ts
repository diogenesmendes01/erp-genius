"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { MensagemThread, NotaInternaThread } from "@/server/whatsapp/consultas-inbox";

function criarRelogioDaThread(ssr: number) {
  // O servidor nunca consulta outro relógio; hidratação usa getServerSnapshot mesmo no cliente.
  let agora = typeof window === "undefined" ? ssr : Date.now();
  return {
    ler: () => agora,
    assinar(notificar: () => void) {
      const atual = Date.now();
      if (atual !== agora) { agora = atual; notificar(); }
      return () => {}; // sem intervalos, timers ou listeners externos
    },
  };
}

/** Snapshot cliente estável até trocar a revisão da thread, seleção ou referência do servidor. */
export function useAgoraDaThread(mensagens: MensagemThread[], notas: NotaInternaThread[] | undefined, selecionado: string | null, agoraInicial?: number): number {
  const ssr = typeof agoraInicial === "number" && Number.isFinite(new Date(agoraInicial).getTime()) ? agoraInicial : 0;
  const revisao = useMemo(() => ({ mensagens, notas, selecionado, ssr }), [mensagens, notas, selecionado, ssr]);
  const relogio = useMemo(() => criarRelogioDaThread(revisao.ssr), [revisao]);
  return useSyncExternalStore(relogio.assinar, relogio.ler, () => ssr);
}
