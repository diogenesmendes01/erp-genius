"use client";

import { forwardRef, useState, type ChangeEvent, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "@/lib/utils";
import { CONTROLE_CAMPO } from "@/components/Campo";
import { garantirFragmentoDocumento } from "@/components/ui/fragmento-documento";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

function IconeChevron({ className, baixo = true }: { className?: string; baixo?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={cn("h-4 w-4", baixo ? "" : "rotate-180", className)} fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

export const SelectTrigger = forwardRef<ElementRef<typeof SelectPrimitive.Trigger>, ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>>(
  function SelectTrigger({ className, children, ...props }, ref) {
    return (
      <SelectPrimitive.Trigger ref={ref} className={cn(CONTROLE_CAMPO, "flex items-center justify-between gap-2 text-left", className)} {...props}>
        {children}
        <SelectPrimitive.Icon asChild><IconeChevron /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
    );
  },
);

export const SelectScrollUpButton = forwardRef<ElementRef<typeof SelectPrimitive.ScrollUpButton>, ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>>(
  function SelectScrollUpButton({ className, ...props }, ref) {
    return (
      <SelectPrimitive.ScrollUpButton ref={ref} className={cn("flex cursor-default items-center justify-center py-1 text-gray-600", className)} {...props}>
        <IconeChevron baixo={false} />
      </SelectPrimitive.ScrollUpButton>
    );
  },
);

export const SelectScrollDownButton = forwardRef<ElementRef<typeof SelectPrimitive.ScrollDownButton>, ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>>(
  function SelectScrollDownButton({ className, ...props }, ref) {
    return (
      <SelectPrimitive.ScrollDownButton ref={ref} className={cn("flex cursor-default items-center justify-center py-1 text-gray-600", className)} {...props}>
        <IconeChevron />
      </SelectPrimitive.ScrollDownButton>
    );
  },
);

export const SelectContent = forwardRef<ElementRef<typeof SelectPrimitive.Content>, ComponentPropsWithoutRef<typeof SelectPrimitive.Content>>(
  function SelectContent({ className, children, position = "popper", ...props }, ref) {
    garantirFragmentoDocumento();
    return (
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          ref={ref}
          position={position}
          className={cn("z-50 max-h-80 min-w-[8rem] overflow-hidden rounded-dialog border border-gray-200 bg-surface-raised text-gray-800 shadow-popover", className)}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.Viewport className={cn("p-1", position === "popper" && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]")}>
            {children}
          </SelectPrimitive.Viewport>
          <SelectScrollDownButton />
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    );
  },
);

export const SelectLabel = forwardRef<ElementRef<typeof SelectPrimitive.Label>, ComponentPropsWithoutRef<typeof SelectPrimitive.Label>>(
  function SelectLabel({ className, ...props }, ref) {
    return <SelectPrimitive.Label ref={ref} className={cn("px-2 py-1.5 text-xs font-medium text-gray-500", className)} {...props} />;
  },
);

export const SelectItem = forwardRef<ElementRef<typeof SelectPrimitive.Item>, ComponentPropsWithoutRef<typeof SelectPrimitive.Item>>(
  function SelectItem({ className, children, ...props }, ref) {
    return (
      <SelectPrimitive.Item
        ref={ref}
        className={cn("relative flex w-full cursor-default select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm text-gray-800 outline-none focus:bg-highlight data-[disabled]:pointer-events-none data-[disabled]:text-disabled", className)}
        {...props}
      >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center text-brand-700">
          <SelectPrimitive.ItemIndicator>
            <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8.5 6.5 12 13 4" /></svg>
          </SelectPrimitive.ItemIndicator>
        </span>
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      </SelectPrimitive.Item>
    );
  },
);

export const SelectSeparator = forwardRef<ElementRef<typeof SelectPrimitive.Separator>, ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>>(
  function SelectSeparator({ className, ...props }, ref) {
    return <SelectPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-gray-200", className)} {...props} />;
  },
);

export type OpcaoSelect = { valor: string; rotulo: ReactNode; disabled?: boolean; title?: string };

export function CampoSelect({
  name, id, value, defaultValue, onValueChange, onChange, disabled, required, placeholder = "Selecionar", opcoes, children, className,
}: {
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (valor: string) => void;
  onChange?: (evento: ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  opcoes?: readonly OpcaoSelect[];
  children?: ReactNode;
  className?: string;
}) {
  const [interno, setInterno] = useState(defaultValue ?? "");
  const val = value !== undefined ? value : interno;
  function mudar(proximo: string) {
    if (value === undefined) setInterno(proximo);
    onValueChange?.(proximo);
    const alvo = { value: proximo, name: name ?? "" };
    onChange?.({ target: alvo, currentTarget: alvo } as ChangeEvent<HTMLInputElement>);
  }
  return (
    <>
      {name ? <input type="hidden" name={name} value={val} required={required} /> : null}
      <Select value={val === "" ? undefined : val} onValueChange={mudar} disabled={disabled} required={required}>
        <SelectTrigger id={id} className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {opcoes?.map((opcao) => (
            <SelectItem key={opcao.valor} value={opcao.valor} disabled={opcao.disabled} title={opcao.title}>{opcao.rotulo}</SelectItem>
          ))}
          {children}
        </SelectContent>
      </Select>
    </>
  );
}
