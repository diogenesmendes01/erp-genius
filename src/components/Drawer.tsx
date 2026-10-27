"use client";

import { useEffect, useRef } from "react";
import { IconX } from "@tabler/icons-react";
import { useDialogo } from "@/lib/dialogo";

export function Drawer({
  id,
  open,
  onClose,
  title,
  children,
  footer,
  lado = "direita",
  largura = "w-full max-w-2xl md:w-[45%]",
}: {
  id?: string;
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  lado?: "direita" | "esquerda";
  largura?: string;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const painel = useRef<HTMLElement>(null);
  useDialogo(painel, { aberto: open, aoFechar: onClose });
  useEffect(() => { if (raiz.current) raiz.current.inert = !open; }, [open]);

  return (
    <div ref={raiz} className={"fixed inset-0 z-50 " + (open ? "" : "pointer-events-none")}>
      <div
        onClick={onClose}
        className={"absolute inset-0 bg-black/60 transition-opacity duration-200 " + (open ? "opacity-100" : "opacity-0")}
      />
      <aside
        id={id}
        ref={painel}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={title}
        tabIndex={-1}
        className={
          `absolute top-0 flex h-full flex-col border-gray-200 bg-surface-raised transition-transform duration-200 ${largura} ` +
          (lado === "esquerda" ? "left-0 border-e " : "right-0 border-s ") +
          (open ? "translate-x-0 shadow-dialog" : lado === "esquerda" ? "-translate-x-full" : "translate-x-full")
        }
      >
        <header className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-medium">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="-m-2 inline-flex min-h-10 min-w-10 items-center justify-center rounded-full text-gray-500 hover:bg-highlight hover:text-gray-700 max-sm:min-h-11 max-sm:min-w-11">
            <IconX size={20} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="border-t border-gray-200 px-5 py-3">{footer}</footer>}
      </aside>
    </div>
  );
}
