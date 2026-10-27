"use client";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useDialogo } from "@/lib/dialogo";
import { posicaoPopover } from "@/lib/popover";
const assinar = () => () => {};
const cliente = () => true;
const servidor = () => false;
export function PopoverFluxo({ titulo, ancora, aoFechar, ocupado = false, children }: { titulo: string; ancora: RefObject<HTMLElement | null>; aoFechar(): void; ocupado?: boolean; children?: ReactNode }) {
  const painel = useRef<HTMLDivElement>(null);
  const camada = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const noCliente = useSyncExternalStore(assinar, cliente, servidor);
  const [portal] = useState(noCliente);
  const [posicao, setPosicao] = useState<{ topo: number; esquerda: number } | null>(null);
  useDialogo(painel, { aberto: true, aoFechar, bloquearFechamento: ocupado, focoAoFechar: ancora, isolar: portal ? camada : undefined });
  useEffect(() => {
    function medir() {
      const alvo = ancora.current; const elemento = painel.current;
      if (!alvo || !elemento) return;
      const rect = elemento.getBoundingClientRect();
      setPosicao(posicaoPopover({ ancora: alvo.getBoundingClientRect(), painel: { largura: rect.width, altura: rect.height }, viewport: { largura: window.innerWidth, altura: window.innerHeight } }));
    }
    medir();
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => { window.removeEventListener("resize", medir); window.removeEventListener("scroll", medir, true); };
  }, [ancora, children]);
  const conteudo = <div ref={camada} className="fixed inset-0 z-50 bg-black/40 sm:bg-transparent" onClick={() => { if (!ocupado) aoFechar(); }}>
    <div ref={painel} role="dialog" aria-modal="true" aria-labelledby={tituloId} tabIndex={-1} onClick={e => e.stopPropagation()}
      style={posicao ? { "--fluxo-topo": `${posicao.topo}px`, "--fluxo-esquerda": `${posicao.esquerda}px` } as React.CSSProperties : undefined}
      className="fixed inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-dialog border border-gray-200 bg-surface-raised p-4 shadow-popover sm:bottom-auto sm:left-[var(--fluxo-esquerda,8px)] sm:right-auto sm:top-[var(--fluxo-topo,8px)] sm:w-[340px] sm:max-w-[calc(100vw-16px)] sm:rounded-dialog">
      <h3 id={tituloId} className="mb-3 text-base font-semibold">{titulo}</h3>{children}
    </div>
  </div>;
  return portal ? createPortal(conteudo, document.body) : conteudo;
}
