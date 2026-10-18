"use client";

import type { ReactNode } from "react";

export const CONTROLE = "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm";

/** Interruptor acessível (`role="switch"`): texto ao lado, nunca só a cor. */
export function Interruptor({ rotulo, descricao, ligado, aoMudar, desabilitado }: {
  rotulo: string;
  descricao?: ReactNode;
  ligado: boolean;
  aoMudar: (v: boolean) => void;
  desabilitado?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="text-sm">
        <p className="font-medium text-gray-800">{rotulo}</p>
        {descricao && <p className="text-gray-600">{descricao}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-label={rotulo}
        disabled={desabilitado}
        onClick={() => aoMudar(!ligado)}
        className={"relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition max-sm:min-h-11 disabled:cursor-not-allowed " + (ligado ? "border-brand-700 bg-brand-solid" : "border-gray-400 bg-surface-muted")}
      >
        <span aria-hidden="true" className={"inline-block h-4 w-4 rounded-full bg-white shadow-none ring-1 ring-gray-400 transition " + (ligado ? "translate-x-6" : "translate-x-1")} />
        <span className="sr-only">{ligado ? "Ligado" : "Desligado"}</span>
      </button>
    </div>
  );
}

/** Lista de textos digitada uma por linha (prioridades, nunca fazer, palavras-chave). */
export const emLinhas = (texto: string): string[] => texto.split("\n").map((l) => l.trim()).filter(Boolean);
