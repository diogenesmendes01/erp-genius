"use client";

import { useCallback, useEffect, useState } from "react";
import type { AbaDados } from "@/server/inbox/painel-abas";

export function urlAbaPainel(atendimentoId: string, aba: AbaDados): string {
  return `/api/inbox/atendimentos/${encodeURIComponent(atendimentoId)}/painel/${aba}`;
}

/** Uma aquisição por chave ativa; respostas de outro contexto nunca aparecem no render atual. */
export function useAbaPainel<T>(atendimentoId: string | null, aba: AbaDados, versao: number, ativo: boolean): {
  dado: T | null; erro: boolean; recarregar(): void;
} {
  const [tentativa, setTentativa] = useState(0);
  const [resultado, setResultado] = useState<{ chave: string; signal: AbortSignal; dado: T | null; erro: boolean } | null>(null);
  const chave = ativo && atendimentoId ? JSON.stringify([atendimentoId, aba, versao, tentativa]) : null;
  const recarregar = useCallback(() => setTentativa(n => n + 1), []);
  useEffect(() => {
    if (!chave || !atendimentoId) return;
    const controle = new AbortController();
    let vigente = true;
    void fetch(urlAbaPainel(atendimentoId, aba), { cache: "no-store", credentials: "same-origin", signal: controle.signal })
      .then(async r => {
        if (!r.ok) throw new Error("Não foi possível carregar os detalhes.");
        const dado = await r.json() as T;
        if (!dado || typeof dado !== "object") throw new Error("Resposta inválida.");
        if (vigente) setResultado({ chave, signal: controle.signal, dado, erro: false });
      })
      .catch(() => { if (vigente) setResultado({ chave, signal: controle.signal, dado: null, erro: true }); });
    return () => { vigente = false; controle.abort(); };
  }, [chave, atendimentoId, aba]);
  const atual = chave !== null && resultado?.chave === chave && !resultado.signal.aborted ? resultado : null;
  return { dado: atual?.dado ?? null, erro: atual?.erro ?? false, recarregar };
}