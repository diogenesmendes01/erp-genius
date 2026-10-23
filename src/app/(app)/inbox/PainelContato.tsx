"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { Botao } from "@/components/Botao";
import { useDialogo } from "@/lib/dialogo";
import { isolarFundoDoPainel } from "./isolamento-painel";
const useEfeitoDeLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Uma montagem para coluna, sobreposição e vista própria: não perde campos ao redimensionar. */
export function PainelContato({ visivel, sobreposto, className, aoFechar, children, focarAoAbrir = false }: {
  visivel: boolean | null; sobreposto: boolean; className: string; aoFechar(): void; children?: ReactNode; focarAoAbrir?: boolean;
}) {
  const painel = useRef<HTMLElement>(null);
  const fechar = useRef<HTMLButtonElement>(null);
  const visivelAnterior = useRef(visivel);
  useEffect(() => {
    const caixa = painel.current;
    if (!caixa) return;
    const focoDentro = caixa.contains(document.activeElement);
    caixa.inert = visivel === false;
    if (visivel && visivelAnterior.current === false && focarAoAbrir && !sobreposto) fechar.current?.focus();
    visivelAnterior.current = visivel;
    if (focoDentro && visivel === false) document.querySelector<HTMLButtonElement>('button[aria-controls="painel-contato"]')?.focus();
  }, [visivel, focarAoAbrir, sobreposto]);
  useDialogo(painel, { aberto: sobreposto, aoFechar, focoInicial: fechar });
  const soltarFundo = useRef<(() => void) | undefined>(undefined);
  // Layout solta antes do cleanup passivo de useDialogo tentar devolver o foco.
  useEfeitoDeLayout(() => {
    if (!sobreposto) return;
    return () => { soltarFundo.current?.(); };
  }, [sobreposto]);
  // Registrado depois de useDialogo: primeiro captura o gatilho e foca; só então isola.
  useEffect(() => {
    if (!sobreposto || !painel.current) return;
    const soltar = isolarFundoDoPainel(painel.current);
    soltarFundo.current = soltar;
    return () => { soltar(); if (soltarFundo.current === soltar) soltarFundo.current = undefined; };
  }, [sobreposto]);
  return (
    <aside id="painel-contato" ref={painel} aria-label="Painel do contato" role={sobreposto ? "dialog" : undefined}
      aria-modal={sobreposto ? true : undefined} aria-hidden={visivel === false ? true : undefined} tabIndex={-1}
      className={className} onKeyDown={(e) => {
        if (sobreposto || e.key !== "Escape") return;
        const alvo = e.target as Element;
        // Portais propagam pelo pai React: a confirmação filha deve consumir seu próprio Escape.
        if (!e.currentTarget.contains(alvo) || alvo.closest('[role="dialog"], [role="alertdialog"]')) return;
        e.stopPropagation(); aoFechar();
      }}>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 p-3">
        <h2 className="font-medium">Painel do contato</h2>
        <Botao variante="fantasma" tamanho="sm" ref={fechar} aria-label="Fechar painel do contato" onClick={aoFechar}
          className="min-h-10">Fechar</Botao>
      </header>
      <div className="relative min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}
