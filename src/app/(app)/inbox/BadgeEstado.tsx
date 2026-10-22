import type { ReactNode } from "react";
import { CLASSES_TOM, type TomEstado } from "./estado-visual";

export function BadgeEstado({ tom, children, ponto = true, tracejado = false, icone }: {
  tom: TomEstado; children: ReactNode; ponto?: boolean; tracejado?: boolean; icone?: ReactNode;
}) {
  const cores = tracejado ? "border border-dashed border-gray-200 text-gray-600" : CLASSES_TOM[tom];
  return <span className={"inline-flex h-5 shrink-0 items-center gap-[5px] whitespace-nowrap rounded-[6px] px-[7px] text-[11px] " + (ponto || tom !== "neutro" ? "font-semibold" : "font-normal") + " " + cores}>
    {ponto && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />}
    {icone}{children}
  </span>;
}
