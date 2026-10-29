"use client";

import { forwardRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { CONTROLE_CAMPO } from "@/components/Campo";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { HORAS, MINUTOS, eventoCampo, isoDataHora, partirData, partirHora, textoDataHora } from "@/components/ui/datas";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> & {
  value?: string;
  defaultValue?: string;
  onChange?: (evento: ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (valor: string) => void;
  fuso?: string;
  tipoInput?: "hidden" | "datetime-local";
};

export const DateTimePicker = forwardRef<HTMLInputElement, Props>(function DateTimePicker(
  { className, value, defaultValue, onChange, onValueChange, name, id, disabled, required, fuso, tipoInput = "hidden", placeholder = "dd/mm/aaaa, hh:mm", ...rest },
  ref,
) {
  const [aberto, setAberto] = useState(false);
  const [interno, setInterno] = useState(typeof defaultValue === "string" ? defaultValue : "");
  const val = value !== undefined ? String(value) : interno;
  const data = partirData(val);
  const { hora, minuto } = partirHora(val);
  function emitir(proximo: string, nativo?: ChangeEvent<HTMLInputElement>) {
    if (value === undefined) setInterno(proximo);
    onValueChange?.(proximo);
    onChange?.(nativo ?? eventoCampo(proximo, name));
  }
  function compor(base: Date | undefined, h: string, m: string) {
    if (!base) return;
    emitir(isoDataHora(base, h, m));
  }
  return (
    <Popover open={aberto} onOpenChange={(proximo) => { if (!disabled && !rest.readOnly) setAberto(proximo); }}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled || rest.readOnly} className={cn(CONTROLE_CAMPO, "inline-flex items-center justify-between gap-2 text-left", className)}>
          <span className={data ? "text-gray-800" : "text-gray-500"}>{data ? textoDataHora(data, hora, minuto) : placeholder}</span>
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-500" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M5 2.5v2M11 2.5v2M2.5 7h11" /></svg>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3">
        <Calendar mode="single" selected={data} defaultMonth={data} onSelect={(dia) => { if (dia) compor(dia, hora, minuto); }} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs text-gray-600">
            Hora
            <select aria-label="Hora" className={CONTROLE_CAMPO} value={hora} disabled={!data} onChange={(e) => data && compor(data, e.target.value, minuto)}>
              {HORAS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-gray-600">
            Minuto
            <select aria-label="Minuto" className={CONTROLE_CAMPO} value={minuto} disabled={!data} onChange={(e) => data && compor(data, hora, e.target.value)}>
              {MINUTOS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </PopoverContent>
      <input
        {...rest}
        ref={ref}
        type={tipoInput}
        id={id}
        name={name}
        value={val}
        disabled={disabled}
        required={required}
        data-fuso={fuso}
        className={tipoInput === "datetime-local" ? "sr-only" : undefined}
        onChange={(e) => emitir(e.target.value, e)}
      />
    </Popover>
  );
});
