import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { CLASSES_TOM, type TomEstado } from "@/components/BadgeEstado";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex h-5 shrink-0 items-center gap-[5px] whitespace-nowrap rounded-[6px] px-[7px] text-[11px] font-semibold",
  { variants: { tom: CLASSES_TOM }, defaultVariants: { tom: "neutro" } },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants> & {
  tom?: TomEstado;
  variant?: TomEstado;
};

export function Badge({ className, tom, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tom: tom ?? variant }), className)} {...props} />;
}
