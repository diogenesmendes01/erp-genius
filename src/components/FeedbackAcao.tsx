"use client";

import { useEffect, useRef } from "react";
import { Aviso } from "@/components/Aviso";
import { MensagemStatus } from "@/components/MensagemStatus";

// Resultado de uma ação, renderizado junto do grupo de botões que a disparou — nunca no topo da
// página nem atrás de um overlay (docs/42-auditoria-frontend-ux.md, E3). Quando um erro aparece, ele
// é trazido para o centro da tela e recebe o foco: o operador que clicou em "Salvar" vê o motivo sem
// procurar, e o leitor de tela o anuncia (role="alert"). Sucesso vai por uma região polite que só existe
// quando a tela passa `sucesso`/`progresso` (mesmo null) — e aí fica montada antes do texto aparecer.
export function FeedbackAcao({ erro, sucesso, progresso, className = "" }: {
  erro: string | null | undefined;
  sucesso?: string | null;
  progresso?: string | null;
  /** Espaçamento no contexto (ex.: "mb-3"); aplicado às caixas visíveis. */
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!erro || !ref.current) return;
    ref.current.scrollIntoView?.({ block: "center" });
    ref.current.focus();
  }, [erro]);

  return (
    <>
      {erro && (
        <Aviso ref={ref} tom="erro" tabIndex={-1} className={className || undefined}>{erro}</Aviso>
      )}
      {/* A região polite só existe onde a tela anuncia sucesso/progresso (prop passada, mesmo que null):
          quem mostra apenas erro não ganha uma região vazia a mais por linha. */}
      {(sucesso !== undefined || progresso !== undefined) && (
        <MensagemStatus texto={sucesso} progresso={progresso} tom="sucesso" className={className || undefined} />
      )}
    </>
  );
}
