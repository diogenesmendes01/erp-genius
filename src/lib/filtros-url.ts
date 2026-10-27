"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarEspera } from "@/lib/espera";

export type CamposFiltro = Record<string, string>;

export function sincronizarCamposFiltro<C extends CamposFiltro>(atuais: C, anteriores: C, novos: C): C {
  const r = { ...atuais };
  for (const k of Object.keys(novos) as (keyof C)[]) if (anteriores[k] !== novos[k]) r[k] = novos[k];
  return r;
}

export function useFiltrosUrl<C extends CamposFiltro>({
  campos: daUrl,
  hrefDosCampos,
  esperaMs = 400,
}: {
  campos: C;
  hrefDosCampos: (c: C) => string;
  esperaMs?: number;
}) {
  const router = useRouter();
  const [buscando, iniciar] = useTransition();
  const [campos, setCampos] = useState<C>(daUrl);
  const anteriores = useRef(daUrl);
  const [espera] = useState(() => criarEspera(esperaMs));
  const chave = JSON.stringify(daUrl);
  useEffect(() => {
    espera.cancelar();
    setCampos((atuais) => sincronizarCamposFiltro(atuais, anteriores.current, daUrl));
    anteriores.current = daUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, espera]);
  useEffect(() => () => espera.cancelar(), [espera]);

  const navegar = (href: string) => iniciar(() => router.push(href));
  const aplicar = (c: C) => { espera.cancelar(); navegar(hrefDosCampos(c)); };
  return {
    campos,
    buscando,
    aplicar,
    mudarTexto: (campo: keyof C) => (e: { target: { value: string } }) => setCampos({ ...campos, [campo]: e.target.value }),
    mudarSelect: (campo: keyof C) => (e: { target: { value: string } }) => {
      const novos = { ...campos, [campo]: e.target.value };
      setCampos(novos);
      espera.agendar(() => aplicar(novos));
    },
    aoClicar: (href: string) => (e: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; button: number; preventDefault: () => void }) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      espera.cancelar();
      navegar(href);
    },
  };
}
