import type { ReactNode } from "react";
import { IconSparkles } from "@tabler/icons-react";

export function LinhaCampo({ icone, valor, rotulo, ia = false, mono = false }: {
  icone: ReactNode;
  valor: ReactNode;
  rotulo: string;
  ia?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex min-h-[52px] items-start gap-4 py-[9px]">
      <span aria-hidden="true" className="mt-[3px] w-5 shrink-0 text-gray-500">{icone}</span>
      <div className="min-w-0 flex-1">
        <div className={"break-words text-[14.5px] font-normal leading-[1.3] text-gray-800 [overflow-wrap:anywhere]" + (mono ? " font-mono tabular-nums" : "")}>{valor}</div>
        <div className="mt-0.5 flex items-center gap-1 text-[12.5px] leading-[1.2] text-gray-600">
          {rotulo}
          {ia && <IconSparkles size={11} className="shrink-0 text-ai-700" aria-label="Preenchido pela Aria" />}
        </div>
      </div>
    </div>
  );
}
