"use client";

import { useEffect, useRef } from "react";
import { Aviso } from "@/components/Aviso";
import { MensagemStatus } from "@/components/MensagemStatus";

export function FeedbackAcao({ erro, sucesso, progresso, className = "" }: {
  erro: string | null | undefined;
  sucesso?: string | null;
  progresso?: string | null;
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
      {(sucesso !== undefined || progresso !== undefined) && (
        <MensagemStatus texto={sucesso} progresso={progresso} tom="sucesso" className={className || undefined} />
      )}
    </>
  );
}
