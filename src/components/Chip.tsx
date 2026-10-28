import type { ReactNode } from "react";
import { PONTO_TOM, type TomEstado } from "@/components/BadgeEstado";

const BASE = "inline-flex items-center gap-1.5 rounded-full border border-border-soft px-3 text-sm max-sm:min-h-11 min-h-8 transition-colors";
const SELECIONADO = "bg-brand-bg text-brand-800 border-transparent";
const NORMAL = "text-gray-600 hover:bg-highlight";

export function Chip({ selecionado, onClick, children, contagem, pontoTom }: {
  selecionado: boolean;
  onClick: () => void;
  children: ReactNode;
  contagem?: number;
  pontoTom?: TomEstado;
}) {
  return (
    <button type="button" aria-pressed={selecionado} onClick={onClick} className={`${BASE} ${selecionado ? SELECIONADO : NORMAL}`}>
      {pontoTom && <span aria-hidden="true" className={`h-[7px] w-[7px] shrink-0 rounded-full ${PONTO_TOM[pontoTom]}`} />}
      {children}
      {contagem !== undefined && <span className="font-mono text-xs tabular-nums opacity-80">{contagem}</span>}
    </button>
  );
}
