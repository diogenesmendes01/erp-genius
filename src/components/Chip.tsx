import type { ReactNode } from "react";

// Filtro em pílula. Selecionado = accent-soft (fundo suave da marca + texto forte); o estado vai em aria-pressed.
const BASE = "inline-flex items-center gap-1.5 rounded-full border border-border-soft px-3 text-sm max-sm:min-h-11 min-h-8 transition-colors";
const SELECIONADO = "bg-brand-bg text-brand-800 border-transparent";
const NORMAL = "text-gray-600 hover:bg-highlight";

export function Chip({ selecionado, onClick, children, contagem }: { selecionado: boolean; onClick: () => void; children: ReactNode; contagem?: number }) {
  return (
    <button type="button" aria-pressed={selecionado} onClick={onClick} className={`${BASE} ${selecionado ? SELECIONADO : NORMAL}`}>
      {children}
      {contagem !== undefined && <span className="text-xs">{contagem}</span>}
    </button>
  );
}
