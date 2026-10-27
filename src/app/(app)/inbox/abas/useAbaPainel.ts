"use client";

import { useCallback, useEffect, useState } from "react";
import type { AbaDados } from "@/server/inbox/painel-abas";

export function urlAbaPainel(atendimentoId: string, aba: AbaDados): string {
  return `/api/inbox/atendimentos/${encodeURIComponent(atendimentoId)}/painel/${aba}`;
}

export function useAbaPainel<T>(atendimentoId: string | null, aba: AbaDados, versao: number, ativo: boolean): {
  dado: T | null; erro: boolean; recarregar(): void;
} {
  const [tentativa, setTentativa] = useState(0);
  const identidade = ativo && atendimentoId ? JSON.stringify([atendimentoId, aba]) : null;
  const chave = ativo && atendimentoId ? JSON.stringify([atendimentoId, aba, versao, tentativa]) : null;
  const [resultado, setResultado] = useState<{ identidade: string | null; chave: string | null; dado: T | null; erro: boolean }>(() => ({ identidade, chave, dado: null, erro: false }));
  if (resultado.identidade !== identidade) setResultado({ identidade, chave, dado: null, erro: false });
  const recarregar = useCallback(() => setTentativa(n => n + 1), []);
  useEffect(() => {
    if (!chave || !atendimentoId) return;
    const controle = new AbortController();
    let vigente = true;
    function falhar(negado = false) {
      if (vigente) setResultado(anterior => anterior.identidade === identidade
        ? { identidade, chave, dado: negado ? null : anterior.dado, erro: negado || anterior.dado === null } : anterior);
    }
    void fetch(urlAbaPainel(atendimentoId, aba), { cache: "no-store", credentials: "same-origin", signal: controle.signal })
      .then(async r => {
        if (!r.ok) { falhar(r.status === 403 || r.status === 404); return; }
        const dado = await r.json() as T;
        if (!dado || typeof dado !== "object") throw new Error("Resposta inválida.");
        if (vigente) setResultado(anterior => anterior.identidade === identidade ? { identidade, chave, dado, erro: false } : anterior);
      })
      .catch(() => falhar());
    return () => { vigente = false; controle.abort(); };
  }, [chave, atendimentoId, aba, identidade]);
  const atual = identidade !== null && resultado.identidade === identidade ? resultado : null;
  return { dado: atual?.dado ?? null, erro: atual?.chave === chave && atual.erro, recarregar };
}
