"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { cn } from "@/lib/utils";

export const Accordion = AccordionPrimitive.Root;

export const AccordionItem = forwardRef<ElementRef<typeof AccordionPrimitive.Item>, ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>>(
  function AccordionItem({ className, ...props }, ref) {
    return <AccordionPrimitive.Item ref={ref} className={cn("border-b border-gray-200", className)} {...props} />;
  },
);

export const AccordionTrigger = forwardRef<ElementRef<typeof AccordionPrimitive.Trigger>, ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>>(
  function AccordionTrigger({ className, children, ...props }, ref) {
    return (
      <AccordionPrimitive.Header className="flex">
        <AccordionPrimitive.Trigger ref={ref} className={cn("flex flex-1 items-center justify-between py-4 text-left text-sm font-medium text-gray-800 hover:bg-highlight focus-visible:outline-none", className)} {...props}>
          {children}
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-500" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6l4 4 4-4" /></svg>
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
    );
  },
);

export const AccordionContent = forwardRef<ElementRef<typeof AccordionPrimitive.Content>, ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>>(
  function AccordionContent({ className, children, ...props }, ref) {
    return (
      <AccordionPrimitive.Content ref={ref} className="overflow-hidden text-sm text-gray-600" {...props}>
        <div className={cn("pb-4 pt-0", className)}>{children}</div>
      </AccordionPrimitive.Content>
    );
  },
);
