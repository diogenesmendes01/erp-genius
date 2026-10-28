import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { BASE_BOTAO, TAMANHOS_BOTAO, VARIANTES_BOTAO, type TamanhoBotao, type VarianteBotao } from "@/components/Botao";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(BASE_BOTAO, {
  variants: {
    variante: VARIANTES_BOTAO,
    tamanho: TAMANHOS_BOTAO,
  },
  defaultVariants: { variante: "primario", tamanho: "md" },
});

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & {
  asChild?: boolean;
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  variant?: VarianteBotao;
  size?: TamanhoBotao;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variante, tamanho, variant, size, asChild = false, type = "button", ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variante: variante ?? variant, tamanho: tamanho ?? size }), className)}
      {...props}
    />
  );
});
