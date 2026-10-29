"use client";

import { forwardRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { CONTROLE_CAMPO } from "@/components/Campo";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HORAS, MINUTOS, eventoCampo, partirHora } from "@/components/ui/datas";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> & {
  value?: string;
  defaultValue?: string;
  onChange?: (evento: ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (valor: string) => void;
};

export const TimePicker = forwardRef<HTMLInputElement, Props>(function TimePicker(
  { className, value, defaultValue, onChange, onValueChange, name, id, disabled, required, placeholder = "hh:mm", ...rest },
  ref,
) {
  const [aberto, setAberto] = useState(false);
  const [interno, setInterno] = useState(defaultValue ?? "");
  const val = value !== undefined ? value : interno;
  const tem = /^(\d{2}):(\d{2})$/.test(val);
  const { hora, minuto } = partirHora(tem ? val : "T00:00");
  function emitir(proximo: string) {
    if (value === undefined) setInterno(proximo);
    onValueChange?.(proximo);
    onChange?.(eventoCampo(proximo, name));
  }
  function compor(h: string, m: string) {
    emitir(`${h}:${m}`);
  }
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} className={cn(CONTROLE_CAMPO, "inline-flex items-center justify-between gap-2 text-left", className)}>
          <span className={tem ? "text-gray-800" : "text-gray-500"}>{tem ? `${hora}:${minuto}` : placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs text-gray-600">
            Hora
            <select aria-label="Hora" className={CONTROLE_CAMPO} value={hora} onChange={(e) => compor(e.target.value, minuto)}>
              {HORAS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-gray-600">
            Minuto
            <select aria-label="Minuto" className={CONTROLE_CAMPO} value={minuto} onChange={(e) => compor(hora, e.target.value)}>
              {MINUTOS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </PopoverContent>
      <input ref={ref} {...rest} type="hidden" id={id} name={name} value={val} disabled={disabled} required={required} onChange={(e) => emitir(e.target.value)} />
    </Popover>
  );
});

export function CampoHora(props: Props) {
  return <TimePicker {...props} />;
}
