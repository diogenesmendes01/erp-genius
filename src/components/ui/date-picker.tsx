"use client";

import { forwardRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { IconCalendar } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { CONTROLE_CAMPO } from "@/components/Campo";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { eventoCampo, isoData, partirData, textoData } from "@/components/ui/datas";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> & {
  value?: string;
  defaultValue?: string;
  onChange?: (evento: ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (valor: string) => void;
};

export const DatePicker = forwardRef<HTMLInputElement, Props>(function DatePicker(
  { className, value, defaultValue, onChange, onValueChange, name, id, disabled, required, placeholder = "dd/mm/aaaa", ...rest },
  ref,
) {
  const [aberto, setAberto] = useState(false);
  const [interno, setInterno] = useState(defaultValue ?? "");
  const val = value !== undefined ? value : interno;
  const data = partirData(val);
  function emitir(proximo: string) {
    if (value === undefined) setInterno(proximo);
    onValueChange?.(proximo);
    onChange?.(eventoCampo(proximo, name));
  }
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} className={cn(CONTROLE_CAMPO, "inline-flex items-center justify-between gap-2 text-left", className)}>
          <span className={data ? "text-gray-800" : "text-gray-500"}>{data ? textoData(data) : placeholder}</span>
          <IconCalendar size={16} aria-hidden="true" className="text-gray-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <Calendar mode="single" selected={data} onSelect={(dia) => { if (!dia) return; emitir(isoData(dia)); setAberto(false); }} defaultMonth={data} />
      </PopoverContent>
      <input ref={ref} {...rest} type="hidden" id={id} name={name} value={val} disabled={disabled} required={required} onChange={(e) => emitir(e.target.value)} />
    </Popover>
  );
});

export function CampoData(props: Props) {
  return <DatePicker {...props} />;
}
