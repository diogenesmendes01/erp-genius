"use client";

import type { ReactNode } from "react";
import { Switch } from "@/components/ui/switch";

export const CONTROLE = "w-full rounded-md border border-gray-200 bg-surface-muted px-2 py-1.5 text-sm text-gray-800";

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
      <Switch checked={ligado} disabled={desabilitado} aria-label={rotulo} onCheckedChange={(v) => aoMudar(v === true)} />
    </div>
  );
}

export const emLinhas = (texto: string): string[] => texto.split("\n").map((l) => l.trim()).filter(Boolean);
