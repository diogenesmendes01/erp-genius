import type { ContagemChipsInbox } from "@/server/inbox/contagens";
import type { FiltrosInbox } from "@/server/inbox/filtros";
import type { TomEstado } from "./estado-visual";
import { hrefDosFiltros } from "./filtros-url";

export const ID_CHIPS = ["todas", "ia", "aprovacao", "handoff", "humano", "sem-resposta", "fila"] as const;
export type IdChip = (typeof ID_CHIPS)[number];
export type ChipAriaInbox = { id: IdChip; rotulo: string; tom: TomEstado; total: number; href: string };

export function filtrosDoChip(id: IdChip, f: FiltrosInbox): FiltrosInbox {
  const novo = { ...f };
  delete novo.aria;
  delete novo.prazoEstourado;
  if (novo.responsavel === "fila") delete novo.responsavel;
  if (id === "ia" || id === "aprovacao" || id === "handoff" || id === "humano") novo.aria = id;
  if (id === "sem-resposta") novo.prazoEstourado = true;
  if (id === "fila") novo.responsavel = "fila";
  return novo;
}
export function chipAtivo(f: FiltrosInbox): IdChip {
  return f.aria ?? (f.prazoEstourado ? "sem-resposta" : f.responsavel === "fila" ? "fila" : "todas");
}
export function chipsDoInbox(c: ContagemChipsInbox, f: FiltrosInbox): ChipAriaInbox[] {
  const chips: Omit<ChipAriaInbox, "href">[] = [
    { id: "todas", rotulo: "Todas", tom: "neutro", total: c.todas },
    { id: "ia", rotulo: "IA atendendo", tom: "ia", total: c.ia },
    { id: "aprovacao", rotulo: "Aprovação", tom: "aprovacao", total: c.aprovacao },
    { id: "handoff", rotulo: "Handoff", tom: "handoff", total: c.handoff },
    { id: "humano", rotulo: "Humanos", tom: "humano", total: c.humano },
    { id: "sem-resposta", rotulo: "Sem resposta", tom: "sem-resposta", total: c.semResposta },
    { id: "fila", rotulo: "Não atribuídas", tom: "neutro", total: c.naoAtribuidas },
  ];
  return chips.map(chip => ({ ...chip, href: hrefDosFiltros("/inbox", filtrosDoChip(chip.id, f)) }));
}
