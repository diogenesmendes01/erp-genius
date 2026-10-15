import Link from "next/link";
import type { ReactNode } from "react";

// Linha de lista (conversas, fila): início (avatar), título + resumo truncados e meta à direita.
const BASE = "flex w-full min-h-[76px] items-center gap-3 rounded-item p-3 text-left transition-colors";
const SELECIONADO = "bg-brand-bg text-brand-800";
const NORMAL = "hover:bg-highlight";

export function ItemLista({
  titulo,
  resumo,
  meta,
  inicio,
  selecionado,
  href,
  onClick,
}: {
  titulo: string;
  resumo?: ReactNode;
  meta?: ReactNode;
  inicio?: ReactNode;
  selecionado?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const classe = `${BASE} ${selecionado ? SELECIONADO : NORMAL}`;
  const corpo = (
    <>
      {inicio !== undefined && <span className="shrink-0">{inicio}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{titulo}</span>
        {resumo !== undefined && <span className="block truncate text-sm text-gray-600">{resumo}</span>}
      </span>
      {meta !== undefined && <span className="shrink-0 self-start text-xs text-gray-600">{meta}</span>}
    </>
  );
  const atual = selecionado ? ("true" as const) : undefined;
  if (href) {
    return (
      <Link href={href} aria-current={atual} onClick={onClick} className={classe}>
        {corpo}
      </Link>
    );
  }
  return (
    <button type="button" aria-current={atual} onClick={onClick} className={classe}>
      {corpo}
    </button>
  );
}
