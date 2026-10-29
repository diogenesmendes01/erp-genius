"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export const Switch = forwardRef<ElementRef<typeof SwitchPrimitive.Root>, ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & { name?: string; value?: string }>(
  function Switch({ className, name, value, checked, ...props }, ref) {
    return (
      <>
        <SwitchPrimitive.Root
          ref={ref}
          checked={checked}
          className={cn("peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-gray-200 bg-surface-muted focus-visible:outline-none disabled:cursor-not-allowed disabled:text-disabled data-[state=checked]:bg-brand-solid", className)}
          {...props}
        >
          <SwitchPrimitive.Thumb className="pointer-events-none block h-4 w-4 translate-x-0.5 rounded-full bg-surface data-[state=checked]:translate-x-4" />
        </SwitchPrimitive.Root>
        {name ? <input type="hidden" name={name} value={checked === true ? (value ?? "on") : ""} /> : null}
      </>
    );
  },
);
