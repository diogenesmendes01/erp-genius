"use client";

import { useId, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useDialogo } from "@/lib/dialogo";

const semAssinatura = () => () => {};
const noNavegador = () => true;
const noServidor = () => false;

export function Modal({ titulo, aoFechar, bloquearFechamento = false, larga = false, folha = false, telaCheiaNoCelular = false, papel = "dialog", descricaoId, focoInicial, focoAoFechar, children }: {
  titulo: React.ReactNode;
  aoFechar: () => void;
  bloquearFechamento?: boolean;
  larga?: boolean;
  folha?: boolean;
  telaCheiaNoCelular?: boolean;
  papel?: "dialog" | "alertdialog";
  descricaoId?: string;
  focoInicial?: RefObject<HTMLElement | null>;
  focoAoFechar?: RefObject<HTMLElement | null>;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const camada = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const clienteAgora = useSyncExternalStore(semAssinatura, noNavegador, noServidor);
  const [emPortal] = useState(clienteAgora);
  useDialogo(ref, { aberto: true, aoFechar, bloquearFechamento, focoInicial, focoAoFechar, isolar: emPortal ? camada : undefined });
  const conteudo = (
    <div ref={camada} className={`fixed inset-0 z-50 flex justify-center bg-black/60 ${telaCheiaNoCelular ? "items-center p-0 sm:p-4" : folha ? "items-end p-0 sm:items-center sm:p-4" : "items-center p-4"}`} onClick={() => { if (!bloquearFechamento) aoFechar(); }}>
      <div
        ref={ref}
        role={papel === "alertdialog" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descricaoId}
        tabIndex={-1}
        className={`overflow-y-auto border border-gray-200 bg-surface-raised p-6 shadow-dialog ${telaCheiaNoCelular
          ? "h-dvh w-full max-w-none rounded-none sm:h-auto sm:max-h-[90dvh] sm:max-w-[calc(100vw-24px)] sm:rounded-dialog"
          : folha
            ? "max-h-[90dvh] w-full max-w-full rounded-dialog rounded-b-none sm:max-w-[calc(100vw-24px)] sm:rounded-b-dialog"
            : "max-h-[90dvh] w-full max-w-[calc(100vw-24px)] rounded-dialog"} ${larga ? "sm:w-[640px]" : "sm:w-[460px]"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={tituloId} className="mb-3 text-xl font-medium">{titulo}</h3>
        {children}
      </div>
    </div>
  );
  return emPortal ? createPortal(conteudo, document.body) : conteudo;
}
