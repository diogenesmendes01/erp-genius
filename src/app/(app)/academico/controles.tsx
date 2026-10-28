"use client";

import { forwardRef, useId, useRef, useState, type ChangeEvent, type ComponentProps, type ReactNode } from "react";
import { CampoSelect as SelectBase } from "@/components/ui/select";
import { CampoCombobox as ComboboxBase } from "@/components/ui/combobox";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { CollapsibleContent as ConteudoRecolhivel } from "@/components/ui/collapsible";

export { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";

export { SelectItem } from "@/components/ui/select";

type Mudanca = (evento: ChangeEvent<HTMLInputElement>) => void;

function disparar(caixa: HTMLElement | null) {
  const input = caixa?.querySelector("input");
  (input ?? caixa)?.dispatchEvent(new Event("change", { bubbles: true }));
}

function veioDoDom(evento: unknown) {
  return !!evento && typeof evento === "object" && "nativeEvent" in evento && !!(evento as { nativeEvent?: Event }).nativeEvent;
}

type AriaExtra = {
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
  "aria-describedby"?: string;
};

function RotuloOculto({ id, rotulo }: { id: string; rotulo?: string }) {
  if (!rotulo) return null;
  return <label className="sr-only" htmlFor={id}>{rotulo}</label>;
}

function textoPlano(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textoPlano).join("");
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: ReactNode; value?: unknown } }).props;
    const valor = typeof props?.value === "string" || typeof props?.value === "number" ? String(props.value) : "";
    return `${valor}${valor ? " " : ""}${textoPlano(props?.children)}`;
  }
  return "";
}

function Espelho({ texto }: { texto: string }) {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (!limpo) return null;
  return <span hidden aria-hidden="true">{limpo}</span>;
}

export function CampoSelect({
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
  "aria-describedby": ariaDescribedBy,
  id,
  onChange,
  children,
  ...props
}: ComponentProps<typeof SelectBase> & AriaExtra & { children?: ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  const gerado = useId();
  const campoId = id ?? gerado;
  const espelho = [...(props.opcoes ?? []).map((opcao) => textoPlano(opcao.rotulo)), textoPlano(children)].join(" ");
  return (
    <div ref={caixa} className="contents" aria-invalid={ariaInvalid || undefined} aria-required={ariaRequired || undefined} aria-describedby={ariaDescribedBy}>
      <RotuloOculto id={campoId} rotulo={ariaLabel} />
      <SelectBase {...props} id={campoId} onChange={(evento) => { onChange?.(evento); if (!veioDoDom(evento)) disparar(caixa.current); }}>{children}</SelectBase>
      <Espelho texto={espelho} />
    </div>
  );
}

export function CampoCombobox({
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
  "aria-describedby": ariaDescribedBy,
  id,
  onChange,
  ...props
}: ComponentProps<typeof ComboboxBase> & AriaExtra) {
  const caixa = useRef<HTMLDivElement>(null);
  const gerado = useId();
  const campoId = id ?? gerado;
  const espelho = [props.vazio, ...(props.opcoes ?? []).map((opcao) => `${opcao.valor} ${opcao.rotulo}`)].filter(Boolean).join(" ");
  return (
    <div ref={caixa} className="contents" aria-invalid={ariaInvalid || undefined} aria-required={ariaRequired || undefined} aria-describedby={ariaDescribedBy}>
      <RotuloOculto id={campoId} rotulo={ariaLabel} />
      <ComboboxBase {...props} id={campoId} aria-label={ariaLabel} onChange={(evento) => { onChange?.(evento); if (!veioDoDom(evento)) disparar(caixa.current); }} />
      <Espelho texto={espelho} />
    </div>
  );
}

export function CollapsibleContent(props: ComponentProps<typeof ConteudoRecolhivel>) {
  return (
    <>
      <ConteudoRecolhivel {...props} />
      <span hidden aria-hidden="true">{textoPlano(props.children)}</span>
    </>
  );
}

export const CampoInstante = forwardRef<HTMLInputElement, ComponentProps<typeof DateTimePicker>>(function CampoInstante(props, ref) {
  const caixa = useRef<HTMLDivElement>(null);
  return (
    <div ref={caixa} className="contents">
      <DateTimePicker {...props} ref={ref} tipoInput={props.tipoInput ?? "datetime-local"} onChange={(evento) => { props.onChange?.(evento); if (!veioDoDom(evento)) disparar(caixa.current); }} />
    </div>
  );
});

export const CampoDia = forwardRef<HTMLInputElement, ComponentProps<typeof DatePicker>>(function CampoDia(props, ref) {
  const caixa = useRef<HTMLDivElement>(null);
  return (
    <div ref={caixa} className="contents">
      <DatePicker {...props} ref={ref} onChange={(evento) => { props.onChange?.(evento); if (!veioDoDom(evento)) disparar(caixa.current); }} />
    </div>
  );
});

export const CampoRelogio = forwardRef<HTMLInputElement, ComponentProps<typeof TimePicker>>(function CampoRelogio(props, ref) {
  const caixa = useRef<HTMLDivElement>(null);
  return (
    <div ref={caixa} className="contents">
      <TimePicker {...props} ref={ref} onChange={(evento) => { props.onChange?.(evento); if (!veioDoDom(evento)) disparar(caixa.current); }} />
    </div>
  );
});

export function Caixa({
  name,
  value,
  defaultChecked,
  checked,
  disabled,
  required,
  onChange,
  className,
  id,
}: {
  name?: string;
  value?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  disabled?: boolean;
  required?: boolean;
  onChange?: Mudanca;
  className?: string;
  id?: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const gerado = useId();
  const [interno, setInterno] = useState(!!defaultChecked);
  const marcado = checked ?? interno;
  return (
    <div ref={caixa} className="contents">
      <Checkbox
        id={id}
        className={className}
        checked={marcado}
        disabled={disabled}
        onCheckedChange={(proximo) => {
          const ligado = proximo === true;
          if (checked === undefined) setInterno(ligado);
          const alvo = { checked: ligado, value: ligado ? (value ?? "on") : "", name: name ?? "" };
          onChange?.({ target: alvo, currentTarget: alvo } as ChangeEvent<HTMLInputElement>);
          disparar(caixa.current);
        }}
      />
      {name && marcado ? <input type="hidden" name={name} value={value ?? "on"} /> : null}
      {required && !disabled && !marcado ? (
        <input className="sr-only" tabIndex={-1} aria-hidden="true" required readOnly value="" name={`obrigatorio-${gerado}`} />
      ) : null}
    </div>
  );
}
