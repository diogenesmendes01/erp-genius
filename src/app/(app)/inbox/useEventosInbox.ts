"use client";
import { useEffect, useRef, useState } from "react";
import type { AvisoInbox } from "@/server/inbox/barramento";

const TIPOS: AvisoInbox["tipo"][] = ["atendimento.atualizado", "mensagem.nova", "mensagem.status", "resync"];

/**
 * Assina `GET /api/inbox/eventos` (SSE). A reconexão é do próprio navegador (EventSource); quando a conexão
 * volta o servidor manda `resync` e quem recebe recarrega o que mostra. Sem polling.
 */
export function useEventosInbox(aoAviso: (a: AvisoInbox) => void): { conectado: boolean } {
  const [conectado, setConectado] = useState(false);
  const callback = useRef(aoAviso);
  useEffect(() => { callback.current = aoAviso; });
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const fonte = new EventSource("/api/inbox/eventos");
    fonte.onopen = () => setConectado(true);
    fonte.onerror = () => setConectado(false);
    // O servidor usa `event: <tipo>`; quadros nomeados não chegam em `onmessage`.
    const ouvinte = (e: Event) => {
      let aviso: AvisoInbox;
      try { aviso = JSON.parse((e as MessageEvent<string>).data) as AvisoInbox; } catch { return; }
      callback.current(aviso);
    };
    for (const tipo of TIPOS) fonte.addEventListener(tipo, ouvinte);
    return () => { fonte.close(); setConectado(false); };
  }, []);
  return { conectado };
}
