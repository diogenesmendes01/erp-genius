"use client";

import { simboloMoeda, parseMoeda, formatarMoedaParaCampo } from "@/lib/dinheiro";

// Substitui type="number" step="0.01" nos campos de dinheiro (ver docs/42-auditoria-frontend-ux.md,
// ganho rápido 13). Duas garantias que o número nativo não dá:
//   1. "1.234" nunca vira 1234 nem 1234 nunca vira 1.234 — parseMoeda rejeita o que for
//      ambíguo em vez de adivinhar (ver src/lib/dinheiro.ts).
//   2. o símbolo da moeda fica visível no campo, então o operador nunca digita achando que
//      é outra moeda.
// Não valida nem bloqueia digitação livre — o operador pode digitar qualquer coisa; só ao
// perder o foco (onBlur) o texto é normalizado para "1234,56" se for interpretável. Texto
// não interpretável fica como está, visível, para o operador corrigir — a validação de
// "campo obrigatório"/"valor inválido" continua sendo responsabilidade de quem usa o campo,
// igual a qualquer outro input controlado deste app.
export function CampoMoeda({
  value,
  onChange,
  moeda,
  id,
  name,
  ariaLabel,
  required,
  placeholder,
  className,
  disabled,
}: {
  value: string;
  onChange: (valor: string) => void;
  /** Omitido quando o valor ainda não tem moeda definida (ex.: previsão antes de escolher
   *  o país) — o campo funciona igual, só não mostra símbolo. */
  moeda?: string;
  id?: string;
  name?: string;
  ariaLabel?: string;
  required?: boolean;
  placeholder?: string;
  /** Classe do input já usada no formulário chamador — CampoMoeda só acrescenta o
   *  espaço à esquerda para o símbolo, sem impor um visual próprio. */
  className: string;
  disabled?: boolean;
}) {
  function normalizarAoSair() {
    const numero = parseMoeda(value);
    if (numero !== null) onChange(formatarMoedaParaCampo(numero));
  }

  return (
    <div className="relative">
      {moeda && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500"
        >
          {simboloMoeda(moeda)}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        id={id}
        name={name}
        aria-label={ariaLabel}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={normalizarAoSair}
        className={moeda ? className + " pl-9" : className}
      />
    </div>
  );
}
