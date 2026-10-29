"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { cn } from "@/lib/utils";

export const CLASSE_CAIXA = "mt-0.5 h-4 w-4 shrink-0 accent-brand-600";

export const Checkbox = forwardRef<ElementRef<typeof CheckboxPrimitive.Root>, ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & { name?: string; value?: string }>(
  function Checkbox({ className, name, value, checked, ...props }, ref) {
    const marcado = checked === true;
    return (
      <>
        <CheckboxPrimitive.Root
          ref={ref}
          checked={checked}
          className={cn("peer h-4 w-4 shrink-0 rounded-md border border-gray-200 bg-surface text-on-brand focus-visible:outline-none disabled:cursor-not-allowed disabled:text-disabled data-[state=checked]:border-brand-500 data-[state=checked]:bg-brand-solid", className)}
          {...props}
        >
          <CheckboxPrimitive.Indicator className="flex items-center justify-center">
            <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8.5 6.5 12 13 4" /></svg>
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
        {name ? <input type="hidden" name={name} value={marcado ? (value ?? "on") : ""} /> : null}
      </>
    );
  },
);
