"use client";
import { useRef, useState } from "react";

export function useOperacao() {
  const [ocupado, setOcupado] = useState(false);
  const emCurso = useRef(false);
  async function iniciar(acao: () => Promise<void>) {
    if (emCurso.current) return;
    emCurso.current = true;
    setOcupado(true);
    try { await acao(); } finally { emCurso.current = false; setOcupado(false); }
  }
  return [ocupado, iniciar] as const;
}
