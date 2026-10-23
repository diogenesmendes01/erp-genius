"use client";
import { useEffect, useRef, useState } from "react";
import type { AvisoInbox } from "@/server/inbox/barramento";

import { assinarEventosCompartilhados } from "@/lib/eventos-inbox";
export { assinarEventosInbox, type FonteEventos } from "@/lib/eventos-inbox";

/** Assina `GET /api/inbox/eventos` (SSE) enquanto o componente está montado. Sem polling. */
export function useEventosInbox(aoAviso: (a: AvisoInbox) => void): { conectado: boolean } {
  const [conectado, setConectado] = useState(false);
  const callback = useRef(aoAviso);
  useEffect(() => { callback.current = aoAviso; });
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    return assinarEventosCompartilhados((a) => callback.current(a), setConectado);
  }, []);
  return { conectado };
}
