import { forwardRef, type ButtonHTMLAttributes } from "react";

// Botão do design system (docs/42-auditoria-frontend-ux.md, E1): havia 32 redações diferentes do
// botão primário. Uma fonte só para variante × tamanho (docs/18: flat, tokens, sem sombra).
//
// Foco: NÃO define anel próprio — o indicador de foco do app é um só, a regra global de
// `button:focus-visible` em globals.css (ganho rápido 7). Um `focus-visible:outline-none` aqui teria
// especificidade maior e o anularia (e o `ring-offset` pintaria um halo branco no tema escuro).
//
// Alvo de toque: abaixo de sm, todo tamanho tem pelo menos 40px de altura (min-h-10); no desktop
// a densidade de cada tamanho é mantida.
//
// `botaoClasses` serve também a quem não é <button> (um <Link> com cara de botão) e à migração, que
// troca só as classes sem mexer no elemento — um <button> sem `type` dentro de <form> continua sendo
// "submit". Código novo usa <Botao>, que é type="button" por padrão (submit só quando declarado).

export type VarianteBotao = "primario" | "secundario" | "perigo" | "fantasma";
export type TamanhoBotao = "sm" | "md" | "lg";

export const BASE_BOTAO =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition max-sm:min-h-10 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export const VARIANTES_BOTAO: Record<VarianteBotao, string> = {
  primario: "bg-brand-solid text-white hover:brightness-95",
  secundario: "border border-gray-300 bg-surface text-gray-700 hover:bg-gray-50",
  perigo: "bg-danger text-white hover:brightness-95",
  fantasma: "text-brand-700 hover:bg-gray-100",
};

export const TAMANHOS_BOTAO: Record<TamanhoBotao, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
  lg: "px-4 py-2 text-sm",
};

export function botaoClasses({ variante = "primario", tamanho = "md" }: { variante?: VarianteBotao; tamanho?: TamanhoBotao } = {}): string {
  return `${BASE_BOTAO} ${VARIANTES_BOTAO[variante]} ${TAMANHOS_BOTAO[tamanho]}`;
}

type PropsBotao = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBotao; tamanho?: TamanhoBotao };

/** Botão com ref encaminhado (Modal/ConfirmarAcao devolvem o foco a ele). */
export const Botao = forwardRef<HTMLButtonElement, PropsBotao>(function Botao(
  { variante, tamanho, className, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={botaoClasses({ variante, tamanho }) + (className ? ` ${className}` : "")} {...props} />;
});
