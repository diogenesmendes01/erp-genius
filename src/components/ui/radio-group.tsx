"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";

export const RadioGroup = forwardRef<ElementRef<typeof RadioGroupPrimitive.Root>, ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> & { name?: string }>(
  function RadioGroup({ className, name, value, ...props }, ref) {
    return (
      <>
        <RadioGroupPrimitive.Root ref={ref} value={value} className={cn("grid gap-2", className)} {...props} />
        {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
      </>
    );
  },
);

export const RadioGroupItem = forwardRef<ElementRef<typeof RadioGroupPrimitive.Item>, ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>>(
  function RadioGroupItem({ className, ...props }, ref) {
    return (
      <RadioGroupPrimitive.Item
        ref={ref}
        className={cn("aspect-square h-4 w-4 rounded-full border border-gray-200 bg-surface text-brand-700 focus-visible:outline-none disabled:cursor-not-allowed disabled:text-disabled", className)}
        {...props}
      >
        <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
          <span className="h-2 w-2 rounded-full bg-brand-solid" />
        </RadioGroupPrimitive.Indicator>
      </RadioGroupPrimitive.Item>
    );
  },
);
