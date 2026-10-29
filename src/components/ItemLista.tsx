import Link from "next/link";
import type { ReactNode } from "react";

const BASE_MD = "flex w-full min-h-[76px] items-center gap-3 rounded-item p-3 text-left transition-colors";
const BASE_SM = "flex w-full min-h-[52px] items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors";
const SELECIONADO = "bg-brand-bg text-brand-800";
const NORMAL = "hover:bg-highlight";
const NORMAL_SM = "hover:bg-surface-muted";

export function ItemLista({
  titulo,
  resumo,
  meta,
  inicio,
  selecionado,
  href,
  onClick,
  tamanho = "md",
  badges,
  metaMono = false,
}: {
  titulo: string;
  resumo?: ReactNode;
  meta?: ReactNode;
  inicio?: ReactNode;
  selecionado?: boolean;
  href?: string;
  onClick?: () => void;
  tamanho?: "sm" | "md";
  badges?: ReactNode;
  metaMono?: boolean;
}) {
  const sm = tamanho === "sm";
  const interativo = href !== undefined || onClick !== undefined;
  const classe = `${sm ? BASE_SM : BASE_MD} ${selecionado ? SELECIONADO : sm ? (interativo ? NORMAL_SM : "") : NORMAL}`;
  const classeMeta = metaMono || sm
    ? "shrink-0 self-start font-mono text-[11.5px] tabular-nums text-gray-600"
    : "shrink-0 self-start text-xs text-gray-600";
  const corpo = (
    <>
      {inicio !== undefined && <span className="shrink-0">{inicio}</span>}
      <span className="min-w-0 flex-1">
        {badges !== undefined ? (
          <span className="flex min-w-0 items-center gap-2">
            <span className="block min-w-0 truncate font-medium">{titulo}</span>
            <span className="flex shrink-0 items-center gap-1">{badges}</span>
          </span>
        ) : (
          <span className="block truncate font-medium">{titulo}</span>
        )}
        {resumo !== undefined && <span className="block truncate text-sm text-gray-600">{resumo}</span>}
      </span>
      {meta !== undefined && <span className={classeMeta}>{meta}</span>}
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
