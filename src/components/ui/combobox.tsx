"use client";

import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CONTROLE_CAMPO } from "@/components/Campo";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { eventoCampo } from "@/components/ui/datas";

const VAZIO = "__vazio__";

export type OpcaoCombobox = { valor: string; rotulo: string; palavras?: string[] };

function semAcento(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function Combobox({
  name, id, value, defaultValue, onValueChange, onChange, opcoes, placeholder = "Selecionar", busca = "Buscar…", vazio, disabled, required, className, "aria-label": ariaLabel,
}: {
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (valor: string) => void;
  onChange?: (evento: ChangeEvent<HTMLInputElement>) => void;
  opcoes: readonly OpcaoCombobox[];
  placeholder?: string;
  busca?: string;
  vazio?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [interno, setInterno] = useState(defaultValue ?? "");
  const val = value !== undefined ? value : interno;
  const lista = useMemo(() => (vazio !== undefined ? [{ valor: "", rotulo: vazio }, ...opcoes] : [...opcoes]), [opcoes, vazio]);
  const atual = lista.find((opcao) => opcao.valor === val);
  function escolher(proximo: string) {
    const real = proximo === VAZIO ? "" : proximo;
    if (value === undefined) setInterno(real);
    onValueChange?.(real);
    onChange?.(eventoCampo(real, name));
    setAberto(false);
  }
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button type="button" id={name ? undefined : id} disabled={disabled} aria-label={ariaLabel} className={cn(CONTROLE_CAMPO, "flex items-center justify-between gap-2 text-left", className)}>
          <span className={cn("min-w-0 truncate", atual ? "text-gray-800" : "text-gray-500")}>{atual?.rotulo || placeholder}</span>
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-500" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6l4 4 4-4" /></svg>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder={busca} />
          <CommandList>
            <CommandEmpty>Nenhum resultado.</CommandEmpty>
            <CommandGroup>
              {lista.map((opcao) => (
                <CommandItem
                  key={opcao.valor || VAZIO}
                  value={opcao.valor || VAZIO}
                  keywords={[opcao.rotulo, opcao.valor, semAcento(opcao.rotulo), ...(opcao.palavras ?? [])]}
                  onSelect={escolher}
                >
                  {opcao.rotulo}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
      {name ? <input type="hidden" name={name} id={id} value={val} required={required} /> : null}
    </Popover>
  );
}

export function CampoCombobox(props: {
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (valor: string) => void;
  onChange?: (evento: ChangeEvent<HTMLInputElement>) => void;
  opcoes: readonly OpcaoCombobox[];
  placeholder?: string;
  vazio?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  children?: ReactNode;
  "aria-label"?: string;
}) {
  return <Combobox {...props} />;
}
