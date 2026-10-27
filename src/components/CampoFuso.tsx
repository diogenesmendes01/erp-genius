"use client";
import { useId, type ChangeEvent } from "react";
import { fusoIanaValido, MSG_FUSO_NAO_RECONHECIDO, normalizarFusoIana } from "@/server/operacao/fuso";

export type SugestaoFuso = string | readonly [valor: string, rotulo: string];

export const FUSOS_SUGERIDOS: readonly SugestaoFuso[] = [
  ["America/Sao_Paulo", "Brasil — São Paulo"],
  ["America/Costa_Rica", "Costa Rica"],
  ["America/Manaus", "Brasil — Manaus"],
  ["America/Rio_Branco", "Brasil — Rio Branco"],
];

export function fusosCanonicos(fusos: readonly string[]): readonly string[] {
  return [...new Set(fusos.map(normalizarFusoIana))].sort();
}

let todosEmCache: readonly string[] | null = null;
export function todosOsFusos(): readonly string[] {
  if (todosEmCache) return todosEmCache;
  try { todosEmCache = typeof Intl.supportedValuesOf === "function" ? fusosCanonicos(Intl.supportedValuesOf("timeZone")) : []; } catch { todosEmCache = []; }
  return todosEmCache;
}

export function validadeDoFuso(valor: string): string {
  const fuso = valor.trim();
  return !fuso || fusoIanaValido(fuso) ? "" : MSG_FUSO_NAO_RECONHECIDO;
}

type Comum = {
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className: string;
  sugestoes?: readonly SugestaoFuso[];
  todos?: boolean;
  opcaoVazia?: string;
  onBlur?: () => void;
  "aria-label"?: string;
  "aria-required"?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};
type Props = Comum & ({ padrao: string; valor?: undefined; onChange?: (valor: string) => void } | { valor: string; padrao?: undefined; onChange: (valor: string) => void });

export function CampoFuso({
  id,
  padrao,
  valor,
  onChange,
  onBlur,
  name = "fuso",
  required = true,
  disabled,
  placeholder,
  className,
  sugestoes = FUSOS_SUGERIDOS,
  todos = false,
  opcaoVazia,
  "aria-label": ariaLabel,
  "aria-required": ariaRequired,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedby,
}: Props) {
  const listaId = `fusos-${useId()}`;
  const controlado = valor !== undefined;
  const lista = sugestoes.map((s): readonly [string, string | undefined] => (typeof s === "string" ? [s, undefined] : s));
  const aoMudar = (evento: ChangeEvent<HTMLInputElement>) => {
    const texto = evento.currentTarget.value;
    evento.currentTarget.setCustomValidity(validadeDoFuso(texto));
    onChange?.(texto);
  };
  return (
    <>
      <input
        id={id}
        name={name}
        list={listaId}
        value={controlado ? valor : undefined}
        defaultValue={controlado ? undefined : padrao}
        onChange={aoMudar}
        onBlur={onBlur}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-required={ariaRequired}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedby}
        maxLength={100}
        className={className}
      />
      <datalist id={listaId}>
        {opcaoVazia !== undefined && <option value="">{opcaoVazia}</option>}
        {lista.map(([v, rotulo]) => <option key={v} value={v}>{rotulo}</option>)}
        {todos && todosOsFusos().filter((f) => !lista.some(([v]) => v === f)).map((f) => <option key={f} value={f} />)}
      </datalist>
    </>
  );
}
