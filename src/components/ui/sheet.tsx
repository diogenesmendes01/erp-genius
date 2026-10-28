"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetPortal = DialogPortal;
export const SheetOverlay = DialogOverlay;

const LADOS = {
  right: "inset-y-0 right-0 h-full w-full max-w-2xl border-s",
  left: "inset-y-0 left-0 h-full w-full max-w-2xl border-e",
  top: "inset-x-0 top-0 border-b",
  bottom: "inset-x-0 bottom-0 border-t",
} as const;

export const SheetContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: keyof typeof LADOS }
>(function SheetContent({ side = "right", className, children, ...props }, ref) {
  return (
    <SheetPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn("fixed z-50 flex flex-col gap-4 border-gray-200 bg-surface-raised p-6 text-gray-800 shadow-dialog outline-none", LADOS[side], className)}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 inline-flex min-h-10 min-w-10 items-center justify-center rounded-full text-gray-500 hover:bg-highlight hover:text-gray-700 focus-visible:outline-none" aria-label="Fechar">
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SheetPortal>
  );
});

export function SheetHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 text-left", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-auto flex flex-wrap justify-end gap-3", className)} {...props} />;
}

export const SheetTitle = forwardRef<ElementRef<typeof DialogPrimitive.Title>, ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(
  function SheetTitle({ className, ...props }, ref) {
    return <DialogPrimitive.Title ref={ref} className={cn("text-base font-medium text-gray-900", className)} {...props} />;
  },
);

export const SheetDescription = forwardRef<ElementRef<typeof DialogPrimitive.Description>, ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(
  function SheetDescription({ className, ...props }, ref) {
    return <DialogPrimitive.Description ref={ref} className={cn("text-sm text-gray-600", className)} {...props} />;
  },
);
