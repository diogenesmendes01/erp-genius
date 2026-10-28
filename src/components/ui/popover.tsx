"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export const PopoverContent = forwardRef<ElementRef<typeof PopoverPrimitive.Content>, ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>>(
  function PopoverContent({ className, align = "start", sideOffset = 4, ...props }, ref) {
    return (
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          ref={ref}
          align={align}
          sideOffset={sideOffset}
          className={cn("z-50 rounded-dialog border border-gray-200 bg-surface-raised p-0 text-gray-800 shadow-popover outline-none", className)}
          {...props}
        />
      </PopoverPrimitive.Portal>
    );
  },
);
