"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarEspera } from "@/lib/espera";

// Filtros de lista na URL (docs/42-auditoria-frontend-ux.md, E4) — a parte de cliente que as listas
// repetiam (alunos, leads): campos controlados sem recriar o formulário, navegação dentro de uma
// transição ("Buscando…"), espera curta nos selects e links reais que navegam na transição.
// Cada lista fornece só o que é dela: os campos a partir dos filtros e o link a partir dos campos.

export type CamposFiltro = Record<string, string>;

/**
 * Quando a URL muda (Limpar, voltar do navegador, link, resultado de um select), só os campos cujo
 * FILTRO mudou são atualizados; os demais mantêm o que a pessoa está digitando. Assim o formulário
 * não é recriado (o foco não se perde) e um select que navega não apaga a busca em edição.
 */
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
  /** Campos derivados dos filtros atuais da URL (recalculados a cada render). */
  campos: C;
  /** Link da lista a partir dos campos — com a mesma leitura/validação do servidor; volta à página 1. */
  hrefDosCampos: (c: C) => string;
  esperaMs?: number;
}) {
  const router = useRouter();
  const [buscando, iniciar] = useTransition();
  const [campos, setCampos] = useState<C>(daUrl);
  const anteriores = useRef(daUrl);
  const [espera] = useState(() => criarEspera(esperaMs));
  // Os campos da URL por valor: o objeto muda de identidade a cada render do servidor.
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
    /** Campo de texto: só atualiza; o envio é pelo formulário. */
    mudarTexto: (campo: keyof C) => (e: { target: { value: string } }) => setCampos({ ...campos, [campo]: e.target.value }),
    /** Select: atualiza e envia após a espera (setas do teclado não criam uma navegação por tecla). */
    mudarSelect: (campo: keyof C) => (e: { target: { value: string } }) => {
      const novos = { ...campos, [campo]: e.target.value };
      setCampos(novos);
      espera.agendar(() => aplicar(novos));
    },
    /** Link real (abre em nova aba, copia) que, no clique simples, navega dentro da transição. */
    aoClicar: (href: string) => (e: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; button: number; preventDefault: () => void }) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      espera.cancelar();
      navegar(href);
    },
  };
}
