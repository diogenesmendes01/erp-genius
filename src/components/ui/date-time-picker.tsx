"use client";

import { forwardRef, useCallback, useEffect, useId, useRef, useState, type ChangeEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CONTROLE_CAMPO } from "@/components/Campo";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select as SelectBase, SelectContent as SelectContentBase, SelectGroup as SelectGroupBase, SelectItem as SelectItemBase, SelectTrigger as SelectTriggerBase, SelectValue as SelectValueBase } from "@/components/ui/select";
import { HORAS, MINUTOS, eventoCampo, isoDataHora, partirData, partirHora, textoDataHora } from "@/components/ui/datas";

type PropsSimples = { children?: ReactNode } & Record<string, unknown>;
const comoSelecao = (componente: unknown) => componente as (props: PropsSimples) => ReactNode;
const Select = comoSelecao(SelectBase);
const SelectContent = comoSelecao(SelectContentBase);
const SelectGroup = comoSelecao(SelectGroupBase);
const SelectItem = comoSelecao(SelectItemBase);
const SelectTrigger = comoSelecao(SelectTriggerBase);
const SelectValue = comoSelecao(SelectValueBase);

type Limite = string | number | readonly string[] | undefined;

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> & {
  value?: string;
  defaultValue?: string;
  onChange?: (evento: ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (valor: string) => void;
  fuso?: string;
};

const RE_DATA_HORA = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?$/;

/**
 * Precisão aceita no valor. O step é em segundos; omitido, vale 60.
 * 0 = só HH:mm, 1 = também HH:mm:ss, 2 = também HH:mm:ss.SSS.
 * Com o step 60, `YYYY-MM-DDTHH:mm:00` é inválido. O picker não herda a tolerância
 * do datetime-local nativo a segundos zerados. Quem não passa step envia minuto
 * (`valorCampoLocal` usa a precisão "minuto").
 */
function precisaoMaxima(step: Limite) {
  const segundos = segundosDoStep(step);
  if (segundos < 1) return 2;
  if (segundos < 60) return 1;
  return 0;
}

function segundosDoStep(step: Limite) {
  if (step === "any") return 0.001;
  if (typeof step === "number" && Number.isFinite(step) && step > 0) return step;
  if (typeof step === "string") {
    const texto = step.trim();
    if (texto === "any") return 0.001;
    const n = Number(texto);
    if (texto !== "" && Number.isFinite(n) && n > 0) return n;
  }
  return 60;
}

function calendarioValido(ano: number, mes: number, dia: number) {
  if (mes < 1 || mes > 12 || dia < 1) return false;
  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
}

function instanteComparavel(valor: string) {
  const m = RE_DATA_HORA.exec(valor);
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const hora = Number(m[4]);
  const minuto = Number(m[5]);
  const segundos = m[6];
  const fracao = m[7];
  if (hora > 23 || minuto > 59 || (segundos !== undefined && Number(segundos) > 59)) return null;
  if (!calendarioValido(ano, mes, dia)) return null;
  const precisao = fracao !== undefined ? 2 : segundos !== undefined ? 1 : 0;
  return { precisao, chave: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${segundos ?? "00"}.${(fracao ?? "").padEnd(3, "0")}` };
}

function chaveLimite(valor: string) {
  if (!valor) return "";
  return instanteComparavel(valor)?.chave ?? valor;
}

export function mensagemRestricaoDataHora(valor: string, restricoes: { required?: boolean; min?: Limite; max?: Limite; step?: Limite }) {
  const texto = valor.trim();
  if (!texto) return restricoes.required ? "Informe data e hora." : "";
  const atual = instanteComparavel(texto);
  if (!atual || atual.precisao > precisaoMaxima(restricoes.step)) return "Informe data e hora.";
  const minimo = chaveLimite(textoLimite(restricoes.min));
  const maximo = chaveLimite(textoLimite(restricoes.max));
  if (minimo && atual.chave < minimo) return "Informe um horário igual ou posterior ao mínimo.";
  if (maximo && atual.chave > maximo) return "Informe um horário igual ou anterior ao máximo.";
  return "";
}

function textoLimite(valor: Limite) {
  if (typeof valor === "number") return String(valor);
  if (typeof valor === "string") return valor;
  return "";
}

function dentroDoPicker(alvo: EventTarget | null) {
  return alvo instanceof Element && !!alvo.closest("[data-seletor-data-hora]");
}

function SeletorTempo({ rotulo, valor, opcoes, disabled, onChange, aoFecharPicker }: { rotulo: string; valor: string; opcoes: readonly string[]; disabled?: boolean; onChange: (valor: string) => void; aoFecharPicker: () => void }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <label htmlFor={id} className="text-xs text-gray-600">{rotulo}</label>
      <Select value={valor} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} aria-label={rotulo}>
          <SelectValue>{valor}</SelectValue>
        </SelectTrigger>
        <SelectContent
          position="popper"
          onEscapeKeyDown={() => aoFecharPicker()}
          onPointerDownOutside={(evento: { target: EventTarget | null }) => { if (!dentroDoPicker(evento.target)) aoFecharPicker(); }}
        >
          <SelectGroup>
            {opcoes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

function EspelhoRestricao({ valor, required, disabled, form, mensagem, aoInvalidar, aoFocar }: { valor: string; required?: boolean; disabled?: boolean; form?: string; mensagem: string; aoInvalidar: () => void; aoFocar: () => void }) {
  return (
    <input
      type="text"
      tabIndex={-1}
      aria-hidden="true"
      className="sr-only"
      value={valor}
      required={required || undefined}
      disabled={disabled || undefined}
      form={form}
      onChange={() => {}}
      onInvalid={(evento) => { evento.preventDefault(); aoInvalidar(); }}
      onFocus={(evento) => { evento.preventDefault(); aoFocar(); }}
      ref={(el) => { el?.setCustomValidity?.(mensagem); }}
    />
  );
}

export const DateTimePicker = forwardRef<HTMLInputElement, Props>(function DateTimePicker(
  {
    className, value, defaultValue, onChange, onValueChange, name, id, disabled, required, fuso,
    placeholder = "dd/mm/aaaa, hh:mm", min, max, step, form, readOnly,
    "aria-label": ariaLabel, "aria-invalid": ariaInvalid, "aria-required": ariaRequired, "aria-describedby": ariaDescribedBy,
    ...rest
  },
  ref,
) {
  const [aberto, setAberto] = useState(false);
  const [erroRevelado, setErroRevelado] = useState(false);
  const [interno, setInterno] = useState(typeof defaultValue === "string" ? defaultValue : "");
  const val = value !== undefined ? String(value) : interno;
  const data = partirData(val);
  const { hora, minuto } = partirHora(val);
  const travado = Boolean(disabled || readOnly);
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  const campoRef = useRef<HTMLInputElement | null>(null);
  const ligarCampo = useCallback((el: HTMLInputElement | null) => {
    campoRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  }, [ref]);
  useEffect(() => {
    const formulario = campoRef.current?.form;
    if (!formulario) return;
    const aoResetar = () => {
      setErroRevelado(false);
      setInterno(defaultValue ?? "");
    };
    formulario.addEventListener("reset", aoResetar);
    return () => formulario.removeEventListener("reset", aoResetar);
  }, [form, defaultValue]);
  const erroId = useId();
  const mensagem = mensagemRestricaoDataHora(val, { required, min, max, step });
  const restringe = Boolean(required || textoLimite(min) || textoLimite(max));
  const mostrarErro = erroRevelado && mensagem !== "";
  const invalidoFora = ariaInvalid === true || ariaInvalid === "true" || ariaInvalid === "grammar" || ariaInvalid === "spelling";
  const invalido = invalidoFora || mostrarErro;
  const descrito = [ariaDescribedBy, mostrarErro ? erroId : null].filter(Boolean).join(" ") || undefined;
  function focarGatilho() {
    gatilhoRef.current?.focus();
  }
  function revelarErro() {
    setErroRevelado(true);
  }
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
    <Popover open={aberto} onOpenChange={(proximo) => { if (!travado) setAberto(proximo); }}>
      <PopoverTrigger asChild>
        {/* eslint-disable jsx-a11y/role-supports-aria-props -- BLOCK-513-A11Y-03: o gatilho visível anuncia obrigatório e inválido */}
        <button
          ref={gatilhoRef}
          type="button"
          id={id}
          disabled={travado}
          aria-label={ariaLabel}
          aria-required={required || ariaRequired ? true : undefined}
          aria-invalid={invalido || undefined}
          aria-describedby={descrito}
          onBlur={(evento) => { if (!(evento.relatedTarget instanceof Element && evento.relatedTarget.closest("[data-seletor-data-hora], [data-radix-popper-content-wrapper], [role='listbox']"))) revelarErro(); }}
          className={cn(CONTROLE_CAMPO, "inline-flex items-center justify-between gap-2 text-left", invalido && "border-red-500", className)}
        >
          <span className={cn(data ? "text-gray-800" : "text-gray-500")}>{data ? textoDataHora(data, hora, minuto) : placeholder}</span>
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-500" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M5 2.5v2M11 2.5v2M2.5 7h11" /></svg>
        </button>
        {/* eslint-enable jsx-a11y/role-supports-aria-props */}
      </PopoverTrigger>
      <PopoverContent data-seletor-data-hora="" className="flex w-auto flex-col gap-3 p-3">
        <Calendar mode="single" selected={data} defaultMonth={data} onSelect={(dia) => { if (dia) compor(dia, hora, minuto); }} />
        <div className="flex gap-2">
          <SeletorTempo rotulo="Hora" valor={hora} opcoes={HORAS} disabled={!data} aoFecharPicker={() => setAberto(false)} onChange={(proxima) => compor(data, proxima, minuto)} />
          <SeletorTempo rotulo="Minuto" valor={minuto} opcoes={MINUTOS} disabled={!data} aoFecharPicker={() => setAberto(false)} onChange={(proximo) => compor(data, hora, proximo)} />
        </div>
      </PopoverContent>
      <input
        {...rest}
        ref={ligarCampo}
        type="hidden"
        name={name}
        value={val}
        disabled={disabled}
        required={required}
        readOnly={readOnly}
        min={min}
        max={max}
        step={step}
        form={form}
        data-fuso={fuso}
        aria-invalid={ariaInvalid || undefined}
        aria-required={ariaRequired || (required ? true : undefined)}
        onChange={(e) => emitir(e.target.value, e)}
      />
      {restringe ? <EspelhoRestricao valor={val} required={required} disabled={travado} form={typeof form === "string" ? form : undefined} mensagem={mensagem} aoInvalidar={() => { revelarErro(); focarGatilho(); }} aoFocar={focarGatilho} /> : null}
      {mostrarErro ? <span id={erroId} role="alert" className="text-xs text-red-700">{mensagem}</span> : null}
    </Popover>
  );
});
