"use client";

import { Children, isValidElement, useState, type ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type EventoValor = { target: { value: string; name?: string }; currentTarget: { value: string; name?: string } };
type EventoCaixa = { target: { checked: boolean; value: string; name?: string } };

function textoDe(no: ReactNode): string {
  if (typeof no === "string" || typeof no === "number") return String(no);
  if (Array.isArray(no)) return no.map(textoDe).join("");
  if (isValidElement<{ children?: ReactNode }>(no)) return textoDe(no.props.children);
  return "";
}

type Opcao = { valor: string; rotulo: ReactNode; disabled?: boolean; title?: string };

function lerOpcoes(children: ReactNode): { opcoes: Opcao[]; placeholder?: ReactNode } {
  const opcoes: Opcao[] = [];
  let placeholder: ReactNode | undefined;
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || child.type !== "option") return;
    const props = child.props as { value?: string | number; disabled?: boolean; title?: string; children?: ReactNode };
    const valor = props.value === undefined || props.value === null ? textoDe(props.children) : String(props.value);
    if (valor === "") {
      placeholder ??= props.children;
      return;
    }
    opcoes.push({ valor, rotulo: props.children, disabled: props.disabled, title: props.title });
  });
  return { opcoes, placeholder };
}

/** Select (ou Combobox) compatível com FormData: o valor vai num input oculto com o mesmo `name`. */
export function SeletorCampo({
  name, id, value, defaultValue, onChange, disabled, required, className, placeholder, busca, children,
  "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy, "aria-describedby": describedBy,
  "aria-invalid": invalid, "aria-required": ariaRequired,
}: {
  name?: string;
  id?: string;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (evento: EventoValor) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
  busca?: boolean;
  children?: ReactNode;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
}) {
  const inicial = defaultValue === undefined || defaultValue === null ? "" : String(defaultValue);
  const [interno, setInterno] = useState(inicial);
  const val = value === undefined || value === null ? interno : String(value);
  const { opcoes, placeholder: doVazio } = lerOpcoes(children);
  const dica = placeholder ?? (typeof doVazio === "string" ? doVazio : undefined) ?? "Selecionar";
  function mudar(proximo: string) {
    if (value === undefined) setInterno(proximo);
    const alvo = { value: proximo, name };
    onChange?.({ target: alvo, currentTarget: alvo });
  }
  const rotulosTexto = opcoes.length > 0 && opcoes.every((o) => typeof o.rotulo === "string" || typeof o.rotulo === "number");
  const usarBusca = !!busca && rotulosTexto;
  const precisaOculto = name !== undefined || !!id || !!describedBy || !!ariaRequired || !!invalid || !!ariaLabelledBy || !!required;
  return (
    <>
      {precisaOculto ? (
        <input
          type="hidden"
          name={name}
          id={id}
          value={val}
          required={required || undefined}
          disabled={disabled || undefined}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-required={ariaRequired || undefined}
        />
      ) : null}
      {usarBusca ? (
        <Combobox
          value={val}
          onValueChange={mudar}
          disabled={disabled}
          className={className}
          placeholder={dica}
          aria-label={ariaLabel}
          opcoes={opcoes.map((o) => ({ valor: o.valor, rotulo: String(o.rotulo) }))}
          vazio={typeof doVazio === "string" ? doVazio : undefined}
        />
      ) : (
        <Select value={val === "" ? undefined : val} onValueChange={mudar} disabled={disabled} required={required}>
          <SelectTrigger className={className} aria-label={ariaLabel} aria-labelledby={ariaLabelledBy}>
            <SelectValue placeholder={dica} />
          </SelectTrigger>
          <SelectContent>
            {opcoes.map((o, i) => (
              <SelectItem key={`${o.valor}-${i}`} value={o.valor} disabled={o.disabled} title={o.title}>{o.rotulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <span className="sr-only" aria-hidden="true">
        {opcoes.map((o, i) => <span key={`${o.valor}-${i}`}>{o.rotulo}</span>)}
      </span>
      {opcoes.map((o, i) => <input key={`valor-${o.valor}-${i}`} type="hidden" value={o.valor} disabled aria-hidden="true" tabIndex={-1} />)}
    </>
  );
}

/** Checkbox cujo valor só entra no FormData quando marcado (igual ao input nativo). */
export function CaixaCampo({
  name, value = "on", checked, defaultChecked = false, onChange, disabled, required, id,
  "aria-label": ariaLabel,
}: {
  name?: string;
  value?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (evento: EventoCaixa) => void;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  "aria-label"?: string;
}) {
  const [interno, setInterno] = useState(defaultChecked);
  const marcado = checked ?? interno;
  function mudar(proximo: boolean | "indeterminate") {
    const real = proximo === true;
    if (checked === undefined) setInterno(real);
    onChange?.({ target: { checked: real, value: real ? value : "", name } });
  }
  return (
    <>
      <Checkbox id={id} checked={marcado} disabled={disabled} aria-label={ariaLabel} aria-required={required || undefined} onCheckedChange={mudar} />
      {name ? <input type="hidden" name={name} value={value} disabled={!marcado || disabled || undefined} /> : null}
      {required ? <input className="sr-only" tabIndex={-1} aria-hidden="true" value={marcado ? "1" : ""} required readOnly onChange={() => {}} /> : null}
    </>
  );
}

export function GrupoRadio({
  name, value, defaultValue = "", onValueChange, disabled, required, className, children,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (valor: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const [interno, setInterno] = useState(defaultValue);
  const val = value ?? interno;
  return (
    <>
      <RadioGroup className={className} value={val || undefined} disabled={disabled} required={required} onValueChange={(proximo) => {
        if (value === undefined) setInterno(proximo);
        onValueChange?.(proximo);
      }}>
        {children}
      </RadioGroup>
      {name && val ? <input type="hidden" name={name} value={val} /> : null}
    </>
  );
}

export { RadioGroupItem };
