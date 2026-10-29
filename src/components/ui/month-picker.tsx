"use client";

import { forwardRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { CONTROLE_CAMPO } from "@/components/Campo";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { eventoCampo, isoMes, nomeMes, partirMes } from "@/components/ui/datas";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> & {
  value?: string;
  defaultValue?: string;
  onChange?: (evento: ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (valor: string) => void;
};

export const MonthPicker = forwardRef<HTMLInputElement, Props>(function MonthPicker(
  { className, value, defaultValue, onChange, onValueChange, name, id, disabled, required, placeholder = "mês/aaaa", ...rest },
  ref,
) {
  const [aberto, setAberto] = useState(false);
  const [interno, setInterno] = useState(defaultValue ?? "");
  const val = value !== undefined ? value : interno;
  const atual = partirMes(val);
  const [ano, setAno] = useState(() => atual?.ano ?? new Date().getFullYear());
  function emitir(proximo: string) {
    if (value === undefined) setInterno(proximo);
    onValueChange?.(proximo);
    onChange?.(eventoCampo(proximo, name));
    setAberto(false);
  }
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} className={cn(CONTROLE_CAMPO, "inline-flex items-center justify-between gap-2 text-left", className)}>
          <span className={atual ? "text-gray-800" : "text-gray-500"}>{atual ? `${nomeMes(atual.mes)} ${atual.ano}` : placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-highlight focus-visible:outline-none" aria-label="Ano anterior" onClick={() => setAno((n) => n - 1)}>‹</button>
          <span className="text-sm font-medium text-gray-800">{ano}</span>
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-highlight focus-visible:outline-none" aria-label="Próximo ano" onClick={() => setAno((n) => n + 1)}>›</button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => {
            const escolhido = atual?.ano === ano && atual.mes === mes;
            return (
              <button
                key={mes}
                type="button"
                className={cn("rounded-md px-2 py-2 text-sm text-gray-800 hover:bg-highlight focus-visible:outline-none", escolhido && "bg-brand-solid text-on-brand hover:bg-brand-solid")}
                onClick={() => emitir(isoMes(ano, mes))}
              >
                {nomeMes(mes).slice(0, 3)}
              </button>
            );
          })}
        </div>
      </PopoverContent>
      <input ref={ref} {...rest} type="hidden" id={id} name={name} value={val} disabled={disabled} required={required} onChange={(e) => emitir(e.target.value)} />
    </Popover>
  );
});

export function CampoMes(props: Props) {
  return <MonthPicker {...props} />;
}
