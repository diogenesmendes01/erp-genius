"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { posicaoPopover, proximoIndiceMenu } from "@/lib/popover";

export const CLASSE_PAINEL_MENU = "min-w-[220px] rounded-[9px] border border-gray-200 bg-surface-raised py-2 shadow-popover";
export const CLASSE_ITEM_MENU =
  "flex w-full items-center gap-3 px-5 py-3 text-left text-sm hover:bg-highlight focus-visible:bg-highlight disabled:cursor-not-allowed disabled:text-disabled";

type ItemMenu = { rotulo: string; icone?: ReactNode; perigo?: boolean; desabilitado?: boolean; aoEscolher: () => void };

// Menu de ações. Posição e teclado vêm de funções puras (@/lib/popover); aqui só se ligam eventos.
export function Menu({ rotulo, gatilho, itens }: { rotulo: string; gatilho: ReactNode; itens: ItemMenu[] }) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<{ topo: number; esquerda: number } | null>(null);
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const fechar = useCallback((devolverFoco: boolean) => {
    setAberto(false);
    setPos(null);
    if (devolverFoco) gatilhoRef.current?.focus();
  }, []);

  const habilitados = () => Array.from(painelRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);

  useLayoutEffect(() => {
    if (!aberto || !gatilhoRef.current || !painelRef.current) return;
    const a = gatilhoRef.current.getBoundingClientRect();
    const p = painelRef.current.getBoundingClientRect();
    const { topo, esquerda } = posicaoPopover({
      ancora: a,
      painel: { largura: p.width, altura: p.height },
      viewport: { largura: window.innerWidth, altura: window.innerHeight },
    });
    setPos({ topo, esquerda });
    habilitados()[0]?.focus();
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!painelRef.current?.contains(alvo) && !gatilhoRef.current?.contains(alvo)) fechar(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto, fechar]);

  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      fechar(true);
      return;
    }
    if (e.key === "Tab") {
      fechar(false);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const lista = habilitados();
      const atual = lista.indexOf(document.activeElement as HTMLButtonElement);
      lista[proximoIndiceMenu(atual, e.key, lista.length)]?.focus();
    }
  };

  return (
    <>
      <button
        ref={gatilhoRef}
        type="button"
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        onClick={() => (aberto ? fechar(false) : setAberto(true))}
        className="inline-flex items-center justify-center rounded-md max-sm:min-h-11 max-sm:min-w-11 hover:bg-highlight"
      >
        {gatilho}
      </button>
      {aberto && (
        <div
          ref={painelRef}
          id={id}
          role="menu"
          aria-label={rotulo}
          onKeyDown={aoTeclar}
          style={{ position: "fixed", top: pos?.topo ?? 0, left: pos?.esquerda ?? 0, visibility: pos ? "visible" : "hidden", zIndex: 50 }}
          className={CLASSE_PAINEL_MENU}
        >
          {itens.map((item) => (
            <button
              key={item.rotulo}
              type="button"
              role="menuitem"
              disabled={item.desabilitado}
              onClick={() => {
                fechar(true);
                item.aoEscolher();
              }}
              className={`${CLASSE_ITEM_MENU} ${item.perigo ? "text-red-700" : "text-gray-800"}`}
            >
              {item.icone}
              {item.rotulo}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
