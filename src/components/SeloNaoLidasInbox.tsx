"use client";
import { useCallback, useSyncExternalStore } from "react";
import type { AvisoInbox } from "@/server/inbox/barramento";
import { assinarEventosCompartilhados } from "@/lib/eventos-inbox";

/** Máquina de recontagem: no máximo um GET em voo e uma repetição pendente, sem polling. */
export function criarLojaNaoLidas(inicial: number, buscar: () => Promise<Response>) {
  let total = inicial; let geracao = 0; let emVoo = false; let pendente = false;
  const ouvintes = new Set<{ notificar: () => void }>();
  const aplicar = (n: number) => { if (n === total) return; total = n; for (const o of [...ouvintes]) o.notificar(); };
  const executar = async () => {
    emVoo = true; const iniciada = geracao;
    let recebida: Response | undefined;
    try {
      const r = await buscar();
      recebida = r;
      if (iniciada !== geracao) return;
      if (r.status === 401 || r.status === 403) { pendente = false; aplicar(0); return; }
      if (!r.ok) return;
      const dado: unknown = await r.json();
      if (iniciada !== geracao || !dado || typeof dado !== "object" || !("total" in dado)) return;
      const n = dado.total; if (typeof n === "number" && Number.isSafeInteger(n) && n >= 0) aplicar(n);
    } catch { /* rede/5xx mantém último total; aviso posterior ou repetição pendente reconcilia */ }
    finally {
      // fetch resolve nos headers. Até uma geração descartada precisa terminar o corpo
      // antes de liberar outro GET; drenar evita abortar e gerar falha de rede no cliente.
      if (recebida && !recebida.bodyUsed) {
        try { await recebida.arrayBuffer(); } catch { /* corpo encerrado com erro também libera o recurso */ }
      }
      emVoo = false;
      if (pendente) { pendente = false; void executar(); }
    }
  };
  const recontar = () => { if (emVoo) pendente = true; else void executar(); };
  return {
    valor: () => total, recontar,
    aoAviso(a: AvisoInbox) { if (a.tipo === "mensagem.nova" || a.tipo === "atendimento.atualizado" || a.tipo === "resync") recontar(); },
    subscribe(notificar: () => void) { const o = { notificar }; ouvintes.add(o); return () => { if (!ouvintes.delete(o)) return; if (!ouvintes.size) { geracao++; pendente = false; } }; },
  };
}
let loja: ReturnType<typeof criarLojaNaoLidas> | null = null;
let assinaturas = 0; let sairEventos: (() => void) | null = null;
export function recontarNaoLidasInbox(): void { if (assinaturas > 0) loja?.recontar(); }
function assinarLoja(inicial: number, ativo: boolean, notificar: () => void): () => void {
  if (!ativo || typeof window === "undefined") return () => {};
  if (!loja) loja = criarLojaNaoLidas(inicial, () => fetch("/api/inbox/nao-lidas", { cache: "no-store", credentials: "same-origin" }));
  const atual = loja; const sair = atual.subscribe(notificar);
  if (assinaturas++ === 0) sairEventos = assinarEventosCompartilhados(atual.aoAviso, () => {});
  // Uma prop SSR nova pode refletir leitura/marcação pessoal sem NOTIFY compartilhado.
  atual.recontar();
  let ativa = true;
  return () => { if (!ativa) return; ativa = false; sair(); if (--assinaturas === 0) { sairEventos?.(); sairEventos = null; } };
}
/** SSR usa somente a prop; loja e rede começam na assinatura, nunca durante render. */
export function useNaoLidasInbox(inicial: number, ativo = true): number {
  const subscribe = useCallback((notificar: () => void) => assinarLoja(inicial, ativo, notificar), [inicial, ativo]);
  return useSyncExternalStore(subscribe, () => ativo ? loja?.valor() ?? inicial : 0, () => ativo ? inicial : 0);
}
export function SeloNaoLidasInbox({ inicial, variante }: { inicial: number; variante: "pilula" | "ponto" }) {
  const total = useNaoLidasInbox(inicial);
  if (total <= 0) return null;
  if (variante === "ponto") return <span aria-hidden className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand-solid" />;
  return <span className="rounded-full bg-brand-solid px-1.5 py-0.5 text-[10px] font-medium leading-none text-on-brand">{total > 99 ? "99+" : total}<span className="sr-only">{total === 1 ? " conversa não lida" : " conversas não lidas"}</span></span>;
}
