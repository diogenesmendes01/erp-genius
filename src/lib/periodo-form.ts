import { useCallback, useRef, useState, type ChangeEvent } from "react";

type AlvoInicio = {
  value: string;
  defaultValue: string;
  form: { addEventListener(tipo: "reset", f: () => void): void; removeEventListener(tipo: "reset", f: () => void): void } | null;
};

/** Sincroniza com o input ao montar e volta ao valor padrão quando o form é resetado; devolve o desligamento. */
export function vincularInicio(alvo: AlvoInicio, definir: (valor: string) => void): () => void {
  definir(alvo.value);
  const form = alvo.form;
  if (!form) return () => {};
  // O evento dispara antes de o form restaurar os campos, então lê o padrão, não o valor atual.
  const aoResetar = () => definir(alvo.defaultValue);
  form.addEventListener("reset", aoResetar);
  return () => form.removeEventListener("reset", aoResetar);
}

/** Início de um par início/fim: `min` do fim acompanha o início exibido, inclusive após reset() ou remontagem. */
export function useInicioDoPeriodo() {
  const [inicio, setInicio] = useState("");
  const desligar = useRef<(() => void) | null>(null);
  const ref = useCallback((el: HTMLInputElement | null) => {
    desligar.current?.();
    desligar.current = el ? vincularInicio(el, setInicio) : null;
    if (!el) setInicio("");
  }, []);
  const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setInicio(e.target.value), []);
  return { propsInicio: { ref, onChange }, min: inicio || undefined };
}
