"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { MensagemThread, NotaInternaThread } from "@/server/whatsapp/consultas-inbox";

function criarRelogioDaThread(ssr: number) {
  let agora = typeof window === "undefined" ? ssr : Date.now();
  return {
    ler: () => agora,
    assinar(notificar: () => void) {
      const atual = Date.now();
      if (atual !== agora) { agora = atual; notificar(); }
      return () => {};
    },
  };
}

export function useAgoraDaThread(mensagens: MensagemThread[], notas: NotaInternaThread[] | undefined, selecionado: string | null, agoraInicial?: number, revisaoExtra?: unknown): number {
  const ssr = typeof agoraInicial === "number" && Number.isFinite(new Date(agoraInicial).getTime()) ? agoraInicial : 0;
  const revisao = useMemo(() => ({ mensagens, notas, selecionado, ssr, revisaoExtra }), [mensagens, notas, selecionado, ssr, revisaoExtra]);
  const relogio = useMemo(() => criarRelogioDaThread(revisao.ssr), [revisao]);
  return useSyncExternalStore(relogio.assinar, relogio.ler, () => ssr);
}
