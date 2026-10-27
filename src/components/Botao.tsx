import { forwardRef, type ButtonHTMLAttributes } from "react";

export type VarianteBotao = "primario" | "secundario" | "perigo" | "perigoContorno" | "fantasma" | "neutro" | "ia" | "iaFantasma";
export type TamanhoBotao = "sm" | "md" | "lg";

export const BASE_BOTAO =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition max-sm:min-h-11 " +
  "aria-busy:cursor-progress disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-disabled disabled:border-gray-200";

export const VARIANTES_BOTAO: Record<VarianteBotao, string> = {
  primario: "bg-brand-solid text-on-brand hover:brightness-95",
  secundario: "border border-border-soft bg-transparent text-brand-700 hover:bg-highlight",
  perigo: "bg-danger text-white hover:brightness-95",
  perigoContorno: "border border-red-700 bg-transparent text-red-700 hover:bg-red-50",
  fantasma: "text-brand-700 hover:bg-highlight",
  iaFantasma: "text-ai-700 hover:bg-highlight",
  neutro: "border border-gray-200 bg-transparent text-gray-800 hover:bg-highlight",
  ia: "bg-ai-50 text-ai-700 hover:bg-highlight",
};

export const TAMANHOS_BOTAO: Record<TamanhoBotao, string> = {
  sm: "px-3 py-1 text-xs",
  md: "px-4 py-1.5 text-sm",
  lg: "px-[22px] py-2.5 text-sm",
};

export function botaoClasses({ variante = "primario", tamanho = "md" }: { variante?: VarianteBotao; tamanho?: TamanhoBotao } = {}): string {
  return `${BASE_BOTAO} ${VARIANTES_BOTAO[variante]} ${TAMANHOS_BOTAO[tamanho]}`;
}

type PropsBotao = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBotao; tamanho?: TamanhoBotao; ocupado?: boolean };

export const Botao = forwardRef<HTMLButtonElement, PropsBotao>(function Botao(
  { variante, tamanho, className, type = "button", ocupado, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={botaoClasses({ variante, tamanho }) + (className ? ` ${className}` : "")}
      aria-busy={ocupado ? true : undefined}
      disabled={disabled || ocupado}
      {...props}
    />
  );
});
