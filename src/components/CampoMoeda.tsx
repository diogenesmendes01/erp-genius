"use client";

import { useState } from "react";
import { simboloMoeda, parseMoeda, formatarMoedaParaCampo, casasDecimais, avisoSemCentavos, avisoPontoAmbiguo } from "@/lib/dinheiro";

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
  "aria-required": ariaRequired,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedby,
}: {
  value: string;
  onChange: (valor: string) => void;
  moeda?: string;
  id?: string;
  name?: string;
  ariaLabel?: string;
  required?: boolean;
  placeholder?: string;
  className: string;
  disabled?: boolean;
  "aria-required"?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const semCentavos = !!moeda && casasDecimais(moeda) === 0;
  const aviso = avisoSemCentavos(value, moeda) ?? avisoPontoAmbiguo(value);
  const avisoId = aviso && id ? `${id}-aviso-moeda` : undefined;
  const descritoPor = [ariaDescribedby, avisoId].filter(Boolean).join(" ") || undefined;
  const [anunciado, setAnunciado] = useState<string | null>(null);

  function normalizarAoSair() {
    const numero = parseMoeda(value);
    if (numero === null || (semCentavos && !Number.isInteger(numero))) {
      setAnunciado(aviso);
      return;
    }
    setAnunciado(null);
    onChange(formatarMoedaParaCampo(numero, moeda));
  }

  return (
    <div>
      <div className="relative">
        {moeda && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 max-w-[2.5rem] -translate-y-1/2 truncate text-sm text-gray-500"
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
          aria-required={ariaRequired}
          aria-invalid={ariaInvalid}
          aria-describedby={descritoPor}
          required={required}
          placeholder={placeholder}
          disabled={disabled}
          value={value}
          onChange={(e) => { setAnunciado(null); onChange(e.target.value); }}
          onBlur={normalizarAoSair}
          className={moeda ? className + " pl-14" : className}
        />
      </div>
      {aviso ? <span id={avisoId} aria-hidden="true" className="mt-1 block text-xs text-amber-700">{aviso}</span> : null}
      <span role="status" className="sr-only">{anunciado}</span>
    </div>
  );
}
