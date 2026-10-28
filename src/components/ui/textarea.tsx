import { forwardRef, type TextareaHTMLAttributes } from "react";
import { CONTROLE_CAMPO } from "@/components/Campo";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(CONTROLE_CAMPO, "min-h-24", className)} {...props} />;
});
