"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export const DropdownMenuContent = forwardRef<ElementRef<typeof DropdownMenuPrimitive.Content>, ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>>(
  function DropdownMenuContent({ className, sideOffset = 4, ...props }, ref) {
    return (
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          className={cn("z-50 min-w-[220px] overflow-hidden rounded-[9px] border border-gray-200 bg-surface-raised py-2 text-gray-800 shadow-popover", className)}
          {...props}
        />
      </DropdownMenuPrimitive.Portal>
    );
  },
);

export const DropdownMenuItem = forwardRef<ElementRef<typeof DropdownMenuPrimitive.Item>, ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>>(
  function DropdownMenuItem({ className, ...props }, ref) {
    return <DropdownMenuPrimitive.Item ref={ref} className={cn("relative flex cursor-default select-none items-center gap-3 px-5 py-3 text-sm text-gray-800 outline-none focus:bg-highlight data-[disabled]:pointer-events-none data-[disabled]:text-disabled", className)} {...props} />;
  },
);

export const DropdownMenuCheckboxItem = forwardRef<ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>, ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>>(
  function DropdownMenuCheckboxItem({ className, children, checked, ...props }, ref) {
    return (
      <DropdownMenuPrimitive.CheckboxItem ref={ref} checked={checked} className={cn("relative flex cursor-default select-none items-center py-2 pl-8 pr-3 text-sm text-gray-800 outline-none focus:bg-highlight data-[disabled]:text-disabled", className)} {...props}>
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center text-brand-700">
          <DropdownMenuPrimitive.ItemIndicator>
            <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8.5 6.5 12 13 4" /></svg>
          </DropdownMenuPrimitive.ItemIndicator>
        </span>
        {children}
      </DropdownMenuPrimitive.CheckboxItem>
    );
  },
);

export const DropdownMenuRadioItem = forwardRef<ElementRef<typeof DropdownMenuPrimitive.RadioItem>, ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>>(
  function DropdownMenuRadioItem({ className, children, ...props }, ref) {
    return (
      <DropdownMenuPrimitive.RadioItem ref={ref} className={cn("relative flex cursor-default select-none items-center py-2 pl-8 pr-3 text-sm text-gray-800 outline-none focus:bg-highlight data-[disabled]:text-disabled", className)} {...props}>
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <DropdownMenuPrimitive.ItemIndicator>
            <span className="h-2 w-2 rounded-full bg-brand-solid" />
          </DropdownMenuPrimitive.ItemIndicator>
        </span>
        {children}
      </DropdownMenuPrimitive.RadioItem>
    );
  },
);

export const DropdownMenuLabel = forwardRef<ElementRef<typeof DropdownMenuPrimitive.Label>, ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>>(
  function DropdownMenuLabel({ className, ...props }, ref) {
    return <DropdownMenuPrimitive.Label ref={ref} className={cn("px-5 py-1.5 text-xs font-medium text-gray-500", className)} {...props} />;
  },
);

export const DropdownMenuSeparator = forwardRef<ElementRef<typeof DropdownMenuPrimitive.Separator>, ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>>(
  function DropdownMenuSeparator({ className, ...props }, ref) {
    return <DropdownMenuPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-gray-200", className)} {...props} />;
  },
);

export function DropdownMenuShortcut({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("ml-auto text-xs text-gray-400", className)} {...props} />;
}

export const DropdownMenuSubTrigger = forwardRef<ElementRef<typeof DropdownMenuPrimitive.SubTrigger>, ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger>>(
  function DropdownMenuSubTrigger({ className, children, ...props }, ref) {
    return (
      <DropdownMenuPrimitive.SubTrigger ref={ref} className={cn("flex cursor-default select-none items-center px-5 py-3 text-sm text-gray-800 outline-none focus:bg-highlight", className)} {...props}>
        {children}
        <svg viewBox="0 0 16 16" aria-hidden="true" className="ml-auto h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 4l4 4-4 4" /></svg>
      </DropdownMenuPrimitive.SubTrigger>
    );
  },
);

export const DropdownMenuSubContent = forwardRef<ElementRef<typeof DropdownMenuPrimitive.SubContent>, ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>>(
  function DropdownMenuSubContent({ className, ...props }, ref) {
    return <DropdownMenuPrimitive.SubContent ref={ref} className={cn("z-50 min-w-[220px] overflow-hidden rounded-[9px] border border-gray-200 bg-surface-raised py-2 text-gray-800 shadow-popover", className)} {...props} />;
  },
);
