"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export const Command = forwardRef<ElementRef<typeof CommandPrimitive>, ComponentPropsWithoutRef<typeof CommandPrimitive>>(
  function Command({ className, ...props }, ref) {
    return <CommandPrimitive ref={ref} className={cn("flex h-full w-full flex-col overflow-hidden rounded-dialog bg-surface-raised text-gray-800", className)} {...props} />;
  },
);

export function CommandDialog({ children, ...props }: ComponentPropsWithoutRef<typeof Dialog>) {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0">
        <DialogTitle className="sr-only">Busca</DialogTitle>
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-gray-500">{children}</Command>
      </DialogContent>
    </Dialog>
  );
}

export const CommandInput = forwardRef<ElementRef<typeof CommandPrimitive.Input>, ComponentPropsWithoutRef<typeof CommandPrimitive.Input>>(
  function CommandInput({ className, ...props }, ref) {
    return (
      <div className="flex items-center border-b border-gray-200 px-3">
        <CommandPrimitive.Input
          ref={ref}
          className={cn("flex h-11 w-full bg-transparent py-3 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:outline-none disabled:cursor-not-allowed disabled:text-disabled", className)}
          {...props}
        />
      </div>
    );
  },
);

export const CommandList = forwardRef<ElementRef<typeof CommandPrimitive.List>, ComponentPropsWithoutRef<typeof CommandPrimitive.List>>(
  function CommandList({ className, ...props }, ref) {
    return <CommandPrimitive.List ref={ref} className={cn("max-h-72 overflow-y-auto overflow-x-hidden p-1", className)} {...props} />;
  },
);

export const CommandEmpty = forwardRef<ElementRef<typeof CommandPrimitive.Empty>, ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>>(
  function CommandEmpty({ className, ...props }, ref) {
    return <CommandPrimitive.Empty ref={ref} className={cn("py-6 text-center text-sm text-gray-500", className)} {...props} />;
  },
);

export const CommandGroup = forwardRef<ElementRef<typeof CommandPrimitive.Group>, ComponentPropsWithoutRef<typeof CommandPrimitive.Group>>(
  function CommandGroup({ className, ...props }, ref) {
    return <CommandPrimitive.Group ref={ref} className={cn("overflow-hidden p-1 text-gray-800", className)} {...props} />;
  },
);

export const CommandSeparator = forwardRef<ElementRef<typeof CommandPrimitive.Separator>, ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>>(
  function CommandSeparator({ className, ...props }, ref) {
    return <CommandPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-gray-200", className)} {...props} />;
  },
);

export const CommandItem = forwardRef<ElementRef<typeof CommandPrimitive.Item>, ComponentPropsWithoutRef<typeof CommandPrimitive.Item>>(
  function CommandItem({ className, ...props }, ref) {
    return <CommandPrimitive.Item ref={ref} className={cn("relative flex cursor-default select-none items-center rounded-md px-2 py-2 text-sm text-gray-800 outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-highlight data-[disabled=true]:text-disabled", className)} {...props} />;
  },
);

export function CommandShortcut({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("ml-auto text-xs text-gray-400", className)} {...props} />;
}
