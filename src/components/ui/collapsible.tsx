"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

export const Collapsible = CollapsiblePrimitive.Root;
export const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;
export const CollapsibleContent = forwardRef<ElementRef<typeof CollapsiblePrimitive.CollapsibleContent>, ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleContent>>(
  function CollapsibleContent(props, ref) {
    return <CollapsiblePrimitive.CollapsibleContent ref={ref} {...props} />;
  },
);
