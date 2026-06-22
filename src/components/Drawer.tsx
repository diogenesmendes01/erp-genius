"use client";

import { useEffect } from "react";
import { IconX } from "@tabler/icons-react";

/**
 * Painel lateral deslizante (desliza da direita, ~45% da tela).
 * Fica sempre montado para animar; quando fechado, fica fora da tela e sem captura de clique.
 * Fecha no ESC e no clique do backdrop. Segue o design system (flat, tokens, sentence case).
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={"fixed inset-0 z-50 " + (open ? "" : "pointer-events-none")} aria-hidden={!open}>
      {/* backdrop */}
      <div
        onClick={onClose}
        className={"absolute inset-0 bg-black/30 transition-opacity duration-200 " + (open ? "opacity-100" : "opacity-0")}
      />
      {/* painel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
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
