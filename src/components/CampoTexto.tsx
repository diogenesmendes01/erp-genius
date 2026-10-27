"use client";

import { forwardRef, useCallback, useEffect, useId, useRef, useState, type TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function dicaDoCampo(tamanho: number, minLength?: number, maxLength?: number): string | null {
  if (minLength === undefined && maxLength === undefined) return null;
  const contagem = maxLength !== undefined ? `${tamanho}/${maxLength}` : `${tamanho} caracteres`;
  if (minLength === undefined) return contagem;
  if (tamanho > 0 && tamanho < minLength) {
    const faltam = minLength - tamanho;
    return `Faltam ${faltam} ${faltam === 1 ? "caractere" : "caracteres"} (mínimo ${minLength}) · ${contagem}`;
  }
  return `Mínimo ${minLength} ${minLength === 1 ? "caractere" : "caracteres"} · ${contagem}`;
}

export const CampoTexto = forwardRef<HTMLTextAreaElement, Props>(function CampoTexto(
  { minLength, maxLength, onChange, "aria-describedby": descritoPor, "aria-invalid": invalidoExterno, ...props },
  ref,
) {
  const dicaId = `${useId()}-dica`;
  const controlado = props.value !== undefined;
  const [digitados, setDigitados] = useState(() => String(props.value ?? props.defaultValue ?? "").length);
  const tamanho = controlado ? String(props.value ?? "").length : digitados;
  const curto = minLength !== undefined && tamanho > 0 && tamanho < minLength;
  const dica = dicaDoCampo(tamanho, minLength, maxLength);

  const interno = useRef<HTMLTextAreaElement | null>(null);
  const ligarRef = useCallback((el: HTMLTextAreaElement | null) => {
    interno.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  }, [ref]);
  useEffect(() => {
    const form = interno.current?.form;
    if (!form || controlado) return;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const aoResetar = () => { espera = setTimeout(() => setDigitados(interno.current?.value.length ?? 0)); };
    form.addEventListener("reset", aoResetar);
    return () => { form.removeEventListener("reset", aoResetar); clearTimeout(espera); };
  }, [controlado]);

  return (
    <>
      <textarea
        ref={ligarRef}
        {...props}
        minLength={minLength}
        maxLength={maxLength}
        aria-describedby={[descritoPor, dica ? dicaId : null].filter(Boolean).join(" ") || undefined}
        aria-invalid={invalidoExterno ?? (curto || undefined)}
        onChange={(e) => {
          if (!controlado) setDigitados(e.target.value.length);
          onChange?.(e);
        }}
      />
      {dica && (
        <span id={dicaId} aria-hidden="true" className={`mt-1 block text-xs ${curto ? "text-red-700" : "text-gray-500"}`}>
          {dica}
        </span>
      )}
    </>
  );
});
