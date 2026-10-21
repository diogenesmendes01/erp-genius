"use client";
import { useEffect, useRef, useState } from "react";
import type { AvisoInbox } from "@/server/inbox/barramento";

const TIPOS: AvisoInbox["tipo"][] = ["atendimento.atualizado", "mensagem.nova", "mensagem.status", "resync"];

/** O que usamos do EventSource (o teste passa uma fonte falsa). */
export type FonteEventos = {
  onopen: ((e: Event) => void) | null;
  onerror: ((e: Event) => void) | null;
  addEventListener(tipo: string, f: (e: Event) => void): void;
  close(): void;
};

/**
 * Assina o SSE do Inbox e devolve a função que encerra a assinatura. A reconexão é do próprio EventSource: o
 * servidor fecha o stream no prazo máximo de vida ou quando a sessão deixa de valer (B9, #201 C6), sugere o
 * intervalo com `retry:` e, na reabertura, confere sessão e papel de novo (401/403 encerram de vez). Avisos do
 * intervalo sem conexão podem ter se perdido: cada reabertura depois da primeira entrega um `resync`, e quem
 * recebe recarrega o que mostra — o mesmo aviso que o servidor manda quando a escuta do banco volta.
 */
export function assinarEventosInbox(
  criar: () => FonteEventos,
  aoAviso: (a: AvisoInbox) => void,
  aoConectado: (conectado: boolean) => void,
): () => void {
  const fonte = criar();
  let jaAbriu = false;
  fonte.onopen = () => {
    aoConectado(true);
    if (jaAbriu) aoAviso({ tipo: "resync", atendimentoId: null, mensagemId: null, conversaId: "" });
    jaAbriu = true;
  };
  fonte.onerror = () => aoConectado(false);
  // O servidor usa `event: <tipo>`; quadros nomeados não chegam em `onmessage`.
  const ouvinte = (e: Event) => {
    let aviso: AvisoInbox;
    try { aviso = JSON.parse((e as MessageEvent<string>).data) as AvisoInbox; } catch { return; }
    aoAviso(aviso);
  };
  for (const tipo of TIPOS) fonte.addEventListener(tipo, ouvinte);
  return () => { fonte.close(); aoConectado(false); };
}

/** Assina `GET /api/inbox/eventos` (SSE) enquanto o componente está montado. Sem polling. */
export function useEventosInbox(aoAviso: (a: AvisoInbox) => void): { conectado: boolean } {
  const [conectado, setConectado] = useState(false);
  const callback = useRef(aoAviso);
  useEffect(() => { callback.current = aoAviso; });
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    return assinarEventosInbox(() => new EventSource("/api/inbox/eventos"), (a) => callback.current(a), setConectado);
  }, []);
  return { conectado };
}
