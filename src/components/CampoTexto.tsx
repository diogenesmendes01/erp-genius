"use client";

import { forwardRef, useCallback, useEffect, useId, useRef, useState, type TextareaHTMLAttributes } from "react";

// Campo de texto longo com o mínimo visível (docs/42-auditoria-frontend-ux.md, E1/E7): havia 266
// <textarea minLength> em que o operador só descobria o mínimo pelo balão do navegador ao enviar (ou
// via um botão desabilitado sem explicação). Substitui <textarea> 1:1 — os mesmos atributos passam
// adiante — e acrescenta, logo abaixo, "Mínimo N caracteres · x/máx", ligado por aria-describedby.
//
// - A dica fica fora do NOME do campo (aria-hidden: o nome continua sendo o do <label>) e entra como
//   DESCRIÇÃO (aria-describedby pode apontar para conteúdo oculto).
// - aria-invalid só quando há texto e ele está abaixo do mínimo — campo vazio não é marcado antes
//   de o operador escrever (o `required` nativo cuida do envio).
// - Funciona controlado (value) ou não (defaultValue + contagem interna, refeita no reset do form).

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

  // Reset do formulário devolve o defaultValue sem disparar onChange: recontar depois do reset.
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
