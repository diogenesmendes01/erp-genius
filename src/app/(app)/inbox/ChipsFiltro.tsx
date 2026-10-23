"use client";
import { usePathname, useRouter } from "next/navigation";
import type { ContagensChipsInbox, FiltrosInbox, IdChipInbox } from "@/server/inbox/filtros";
import { PONTO_TOM, type TomEstado } from "./estado-visual";
import { filtrosDoChip, hrefDosFiltros } from "./filtros-url";
export type ChipFiltroInbox = { id: IdChipInbox; rotulo: string; tom: TomEstado; total: number };
export function chipsDaColuna(c?: ContagensChipsInbox): ChipFiltroInbox[] {
 return [
  { id: "todas", rotulo: "Todas", tom: "neutro", total: c?.todas ?? 0 },
  { id: "minhas", rotulo: "Minhas", tom: "humano", total: c?.minhas ?? 0 },
  { id: "naoLidas", rotulo: "Não lidas", tom: "neutro", total: c?.naoLidas ?? 0 },
  { id: "prazo", rotulo: "Prazo estourado", tom: "sem-resposta", total: c?.prazo ?? 0 },
  { id: "fila", rotulo: "Não atribuídas", tom: "neutro", total: c?.fila ?? 0 },
 ];
}
export function ChipsFiltro({ chips, ativo, filtros }: { chips: ChipFiltroInbox[]; ativo: string | null; filtros: FiltrosInbox }) {
 const router = useRouter(); const caminho = usePathname() ?? "/inbox";
 return <div role="group" aria-label="Filtros rápidos" className="flex flex-wrap gap-1.5 px-[18px] pb-2.5">
  {chips.map((c) => <button key={c.id} type="button" aria-pressed={ativo === c.id}
   className={"flex h-7 items-center gap-1.5 whitespace-nowrap rounded-[20px] border px-2.5 text-[12.5px] font-medium " + (ativo === c.id ? "border-transparent bg-gray-100 text-gray-800" : "border-gray-200 text-gray-600 hover:bg-surface-muted")}
   onClick={() => router.replace(hrefDosFiltros(caminho, filtrosDoChip(c.id, filtros)))}>
   <span aria-hidden="true" className={"h-[7px] w-[7px] rounded-full " + PONTO_TOM[c.tom]} />
   {c.rotulo}<span className="font-mono text-[11px] opacity-70">{c.total}</span>
  </button>)}
 </div>;
}
