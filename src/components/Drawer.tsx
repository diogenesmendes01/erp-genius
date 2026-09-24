"use client";

import { useEffect, useRef } from "react";
import { IconX } from "@tabler/icons-react";
import { useDialogo } from "@/lib/dialogo";

/**
 * Painel lateral deslizante (desliza da direita, ~45% da tela).
 * Fica sempre montado para animar. Fechado, fica `inert` — fora da tela, sem clique, fora da ordem de
 * Tab e da árvore de acessibilidade (antes era só aria-hidden, com ~25 controles focáveis dentro).
 * Aberto: Escape e clique no fundo fecham, o foco entra no painel, fica preso nele e volta a quem
 * abriu ao fechar (useDialogo). Segue o design system (flat, tokens, sentence case).
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const painel = useRef<HTMLElement>(null);
  useDialogo(painel, { aberto: open, aoFechar: onClose });
  // `inert` pela propriedade do DOM: os tipos do React 18 ainda não conhecem o atributo.
  useEffect(() => { if (raiz.current) raiz.current.inert = !open; }, [open]);

  return (
    <div ref={raiz} className={"fixed inset-0 z-50 " + (open ? "" : "pointer-events-none")}>
      {/* backdrop */}
      <div
        onClick={onClose}
        className={"absolute inset-0 bg-black/30 transition-opacity duration-200 " + (open ? "opacity-100" : "opacity-0")}
      />
      {/* painel */}
      <aside
        ref={painel}
        // Só é diálogo enquanto aberto; fechado, além de inert, deixa de se anunciar como modal.
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={title}
        tabIndex={-1}
        className={
          "absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col border-l border-gray-200 bg-surface transition-transform duration-200 md:w-[45%] " +
          (open ? "translate-x-0" : "translate-x-full")
        }
      >
        <header className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-medium">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-gray-500 hover:text-gray-700">
            <IconX size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="border-t border-gray-200 px-5 py-3">{footer}</footer>}
      </aside>
    </div>
  );
}
