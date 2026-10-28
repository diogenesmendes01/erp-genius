import { forwardRef, type InputHTMLAttributes } from "react";
import { CONTROLE_CAMPO } from "@/components/Campo";
import { cn } from "@/lib/utils";

export const CLASSE_INPUT = CONTROLE_CAMPO;

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, type = "text", ...props }, ref) {
  return <input ref={ref} type={type} className={cn(CLASSE_INPUT, className)} {...props} />;
});
