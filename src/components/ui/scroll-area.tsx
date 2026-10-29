"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";

export const ScrollArea = forwardRef<ElementRef<typeof ScrollAreaPrimitive.Root>, ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>>(
  function ScrollArea({ className, children, ...props }, ref) {
    return (
      <ScrollAreaPrimitive.Root ref={ref} className={cn("relative overflow-hidden", className)} {...props}>
        <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">{children}</ScrollAreaPrimitive.Viewport>
        <ScrollBar />
        <ScrollAreaPrimitive.Corner />
      </ScrollAreaPrimitive.Root>
    );
  },
);

export const ScrollBar = forwardRef<ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>, ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>>(
  function ScrollBar({ className, orientation = "vertical", ...props }, ref) {
    return (
      <ScrollAreaPrimitive.ScrollAreaScrollbar
        ref={ref}
        orientation={orientation}
        className={cn("flex touch-none select-none bg-surface-muted", orientation === "vertical" ? "h-full w-2.5 border-l border-gray-200 p-px" : "h-2.5 flex-col border-t border-gray-200 p-px", className)}
        {...props}
      >
        <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-gray-400" />
      </ScrollAreaPrimitive.ScrollAreaScrollbar>
    );
  },
);
