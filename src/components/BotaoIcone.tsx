"use client";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
type TamanhoIcone = 28 | 34 | 36 | 44;
const MEDIDAS: Record<TamanhoIcone, string> = { 28: "h-[28px] w-[28px]", 34: "h-[34px] w-[34px]", 36: "h-[36px] w-[36px]", 44: "h-[44px] w-[44px]" };
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { rotulo: string; ativo?: boolean; tamanho?: TamanhoIcone; children: ReactNode };
/** Controle de ícone: nome acessível e foco global do DS, inclusive Fechar28. */
export const BotaoIcone = forwardRef<HTMLButtonElement, Props>(function BotaoIcone({ rotulo, ativo = false, tamanho = 34, className = "", type = "button", ...props }, ref) {
 return <button {...props} ref={ref} type={type} aria-label={rotulo} title={props.title ?? rotulo}
  className={"relative inline-flex shrink-0 items-center justify-center rounded-full text-gray-600 transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:text-disabled " + MEDIDAS[tamanho] + (ativo ? " bg-gray-100" : "") + " " + className} />;
});
