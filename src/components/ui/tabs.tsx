"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<ElementRef<typeof TabsPrimitive.List>, ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(
  function TabsList({ className, ...props }, ref) {
    return <TabsPrimitive.List ref={ref} className={cn("inline-flex items-center justify-center rounded-md bg-surface-muted p-1 text-gray-600", className)} {...props} />;
  },
);

export const TabsTrigger = forwardRef<ElementRef<typeof TabsPrimitive.Trigger>, ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(
  function TabsTrigger({ className, ...props }, ref) {
    return (
      <TabsPrimitive.Trigger
        ref={ref}
        className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-highlight focus-visible:outline-none disabled:pointer-events-none disabled:text-disabled data-[state=active]:bg-surface data-[state=active]:text-gray-900", className)}
        {...props}
      />
    );
  },
);

export const TabsContent = forwardRef<ElementRef<typeof TabsPrimitive.Content>, ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(
  function TabsContent({ className, ...props }, ref) {
    return <TabsPrimitive.Content ref={ref} className={cn("mt-2 focus-visible:outline-none", className)} {...props} />;
  },
);
