import type { ReactNode } from "react";
import { IconSparkles } from "@tabler/icons-react";

export function LinhaCampo({ icone, valor, rotulo, ia = false }: { icone: ReactNode; valor: ReactNode; rotulo: string; ia?: boolean }) {
  return <div className="flex min-h-[52px] items-center gap-4 py-[9px]">
    <span aria-hidden="true" className="w-5 shrink-0 text-gray-600">{icone}</span>
    <div className="min-w-0 flex-1">
      <div className="text-[14.5px] [overflow-wrap:anywhere]">{valor}{ia && <IconSparkles size={12} className="ml-1 inline text-ai-700" aria-label="Preenchido pela Aria" />}</div>
      <div className="text-[12.5px] text-gray-600">{rotulo}</div>
    </div>
  </div>;
}
