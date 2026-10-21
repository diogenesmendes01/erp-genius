import { forwardRef, type ButtonHTMLAttributes } from "react";

// Botão do design system (docs/42-auditoria-frontend-ux.md, E1): havia 32 redações diferentes do
// botão primário. Uma fonte só para variante × tamanho (docs/18: pílula, tokens, sem sombra; disabled sem opacidade).
//
// Foco: NÃO define anel próprio — o indicador de foco do app é um só, a regra global de
// `button:focus-visible` em globals.css (ganho rápido 7). Um `focus-visible:outline-none` aqui teria
// especificidade maior e o anularia (e o `ring-offset` pintaria um halo branco no tema escuro).
//
// Alvo de toque: abaixo de sm, todo tamanho tem pelo menos 44px de altura (min-h-11); no desktop
// a densidade de cada tamanho é mantida.
//
// `botaoClasses` serve também a quem não é <button> (um <Link> com cara de botão) e à migração, que
// troca só as classes sem mexer no elemento — um <button> sem `type` dentro de <form> continua sendo
// "submit". Código novo usa <Botao>, que é type="button" por padrão (submit só quando declarado).

export type VarianteBotao = "primario" | "secundario" | "perigo" | "fantasma";
export type TamanhoBotao = "sm" | "md" | "lg";

export const BASE_BOTAO =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition max-sm:min-h-11 " +
  "aria-busy:cursor-progress disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-disabled disabled:border-gray-200";

export const VARIANTES_BOTAO: Record<VarianteBotao, string> = {
  primario: "bg-brand-solid text-on-brand hover:brightness-95",
  secundario: "border border-border-soft bg-transparent text-brand-700 hover:bg-highlight",
  perigo: "bg-danger text-white hover:brightness-95",
  fantasma: "text-brand-700 hover:bg-highlight",
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

/** Botão com ref encaminhado (Modal/ConfirmarAcao devolvem o foco a ele). */
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
