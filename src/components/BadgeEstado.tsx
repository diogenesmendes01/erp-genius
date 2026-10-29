import type { ReactNode } from "react";

export type TomEstado =
  | "brand"
  | "humano"
  | "sucesso"
  | "aviso"
  | "aprovacao"
  | "sem-resposta"
  | "perigo"
  | "handoff"
  | "atraso"
  | "ia"
  | "frio"
  | "neutro";

const CLASSE_MARCA = "bg-[var(--brand-soft)] text-[var(--brand-text)]";
const CLASSE_AVISO = "bg-[var(--warning-soft)] text-[var(--warning-text)]";
const CLASSE_PERIGO = "bg-[var(--danger-soft)] text-[var(--danger-text)]";
const CLASSE_INFO = "bg-[var(--info-soft)] text-[var(--info-text)]";

export const CLASSES_TOM: Record<TomEstado, string> = {
  brand: CLASSE_MARCA,
  humano: CLASSE_MARCA,
  sucesso: CLASSE_MARCA,
  aviso: CLASSE_AVISO,
  aprovacao: CLASSE_AVISO,
  "sem-resposta": CLASSE_AVISO,
  perigo: CLASSE_PERIGO,
  handoff: CLASSE_PERIGO,
  atraso: CLASSE_PERIGO,
  ia: CLASSE_INFO,
  frio: CLASSE_INFO,
  neutro: "bg-surface-muted text-gray-600",
};

const PONTO_MARCA = "bg-brand-solid";
const PONTO_AVISO = "bg-[var(--warning-solid)]";
const PONTO_PERIGO = "bg-[var(--danger-solid)]";
const PONTO_INFO = "bg-[var(--info-solid)]";

export const PONTO_TOM: Record<TomEstado, string> = {
  brand: PONTO_MARCA,
  humano: PONTO_MARCA,
  sucesso: PONTO_MARCA,
  aviso: PONTO_AVISO,
  aprovacao: PONTO_AVISO,
  // A inbox ainda procura bg-amber-600 no chip de sem resposta.
  "sem-resposta": `${PONTO_AVISO} bg-amber-600`,
  perigo: PONTO_PERIGO,
  handoff: PONTO_PERIGO,
  // Valor exato travado por estado-visual.test.ts. red-600 aponta para --danger-text.
  atraso: "bg-red-600",
  ia: PONTO_INFO,
  frio: PONTO_INFO,
  neutro: "bg-gray-500",
};

const TEXTO_MARCA = "text-[var(--brand-text)]";
const TEXTO_AVISO = "text-[var(--warning-text)]";
const TEXTO_PERIGO = "text-[var(--danger-text)]";
const TEXTO_INFO = "text-[var(--info-text)]";

export const TEXTO_TOM: Record<TomEstado, string> = {
  brand: TEXTO_MARCA,
  // Alias Tailwind de --brand-text, travado por estado-visual.test.ts.
  humano: "text-brand-700",
  sucesso: TEXTO_MARCA,
  aviso: TEXTO_AVISO,
  aprovacao: TEXTO_AVISO,
  "sem-resposta": TEXTO_AVISO,
  perigo: TEXTO_PERIGO,
  // text-red-700 permanece para o subtítulo de handoff da inbox.
  handoff: `${TEXTO_PERIGO} text-red-700`,
  atraso: TEXTO_PERIGO,
  ia: TEXTO_INFO,
  frio: TEXTO_INFO,
  // text-gray-600 é o valor que a inbox já exportava; gray-500 e gray-600 resolvem o mesmo token.
  neutro: "text-gray-600",
};

/** Utilitários anteriores ainda procurados no HTML da inbox. Não entram no mapa canônico. */
const CLASSES_LEGADAS: Partial<Record<TomEstado, string>> = {
  ia: "bg-ai-50 text-ai-700",
  aprovacao: "bg-amber-50 text-amber-700",
  "sem-resposta": "bg-amber-50 text-amber-700",
  handoff: "bg-red-50 text-red-700",
  atraso: "bg-red-50 text-red-700",
  humano: "bg-brand-bg text-brand-700",
};

export type PropsBadgeEstado = {
  tom: TomEstado;
  ponto?: boolean;
  tracejado?: boolean;
  icone?: ReactNode;
  className?: string;
  "aria-label"?: string;
  role?: string;
  children: ReactNode;
};

export function BadgeEstado({
  tom,
  children,
  ponto = true,
  tracejado = false,
  icone,
  className,
  "aria-label": ariaLabel,
  role,
}: PropsBadgeEstado) {
  const legado = CLASSES_LEGADAS[tom];
  const cores = tracejado
    ? "border border-dashed border-gray-200 text-gray-600"
    : legado ? `${CLASSES_TOM[tom]} ${legado}` : CLASSES_TOM[tom];
  return (
    <span
      role={role}
      aria-label={ariaLabel}
      className={"inline-flex h-5 shrink-0 items-center gap-[5px] whitespace-nowrap rounded-[6px] px-[7px] text-[11px] " + (ponto || tom !== "neutro" ? "font-semibold" : "font-normal") + " " + cores + (className ? " " + className : "")}
    >
      {ponto && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />}
      {icone}{children}
    </span>
  );
}
