"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = forwardRef<ElementRef<typeof TooltipPrimitive.Content>, ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>>(
  function TooltipContent({ className, sideOffset = 4, ...props }, ref) {
    return (
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          className={cn("z-50 overflow-hidden rounded-md border border-gray-200 bg-surface-raised px-3 py-1.5 text-xs text-gray-800 shadow-popover", className)}
          {...props}
        />
      </TooltipPrimitive.Portal>
    );
  },
);
