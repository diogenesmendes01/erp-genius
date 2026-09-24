import type { ButtonHTMLAttributes } from "react";

// Botão do design system (docs/42-auditoria-frontend-ux.md, E1): havia 32 redações diferentes do
// botão primário e nenhuma com foco visível. Uma fonte só para variante × tamanho, com
// `focus-visible` e `disabled` embutidos (docs/18: flat, tokens, sem sombra).
//
// `botaoClasses` serve também a quem não é <button> (um <Link> com cara de botão) e à migração, que
// troca só as classes sem mexer no elemento — um <button> sem `type` dentro de <form> continua sendo
// "submit". Código novo usa <Botao>, que é type="button" por padrão (submit só quando declarado).

export type VarianteBotao = "primario" | "secundario" | "perigo" | "fantasma";
export type TamanhoBotao = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTES: Record<VarianteBotao, string> = {
  primario: "bg-brand-solid text-white hover:brightness-95",
  secundario: "border border-gray-300 bg-surface text-gray-700 hover:bg-gray-50",
  perigo: "bg-danger text-white hover:brightness-95",
  fantasma: "text-brand-700 hover:bg-gray-100",
};

const TAMANHOS: Record<TamanhoBotao, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
  lg: "px-4 py-2 text-sm",
};

export function botaoClasses({ variante = "primario", tamanho = "md" }: { variante?: VarianteBotao; tamanho?: TamanhoBotao } = {}): string {
  return `${BASE} ${VARIANTES[variante]} ${TAMANHOS[tamanho]}`;
}

export function Botao({
  variante,
  tamanho,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBotao; tamanho?: TamanhoBotao }) {
  return <button type={type} className={botaoClasses({ variante, tamanho }) + (className ? ` ${className}` : "")} {...props} />;
}
