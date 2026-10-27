import type { FilaCobrancaItem } from "./consultas";

import type { NavegacaoFila } from "@/lib/cursor-fila";
import type { CursorDoLink } from "@/components/PaginacaoFila";

export const ROTA_FILA = "/financeiro/cobrancas";

export const FILA_COBRANCA_POR_TRECHO = 50;

export const INDICADORES_FILA = ["aVencer", "emAtraso", "bloquear", "promessas"] as const;
export type IndicadorFila = (typeof INDICADORES_FILA)[number];

export type FiltrosFila = {
  indicador: IndicadorFila | null;
  busca: string;
  pais: string | null;
  turma: string | null;
};

type Parametros = Record<string, string | string[] | undefined> | URLSearchParams;

function valor(p: Parametros, chave: string): string {
  const v = p instanceof URLSearchParams ? p.get(chave) : p[chave];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

export function lerFiltrosFila(p: Parametros): FiltrosFila {
  const indicador = valor(p, "indicador");
  return {
    indicador: (INDICADORES_FILA as readonly string[]).includes(indicador) ? (indicador as IndicadorFila) : null,
    busca: valor(p, "busca").slice(0, 100),
    pais: valor(p, "pais").slice(0, 100) || null,
    turma: valor(p, "turma").slice(0, 100) || null,
  };
}

export function filtrosFilaParaQuery(f: FiltrosFila): string {
  const q = new URLSearchParams();
  if (f.indicador) q.set("indicador", f.indicador);
  if (f.busca) q.set("busca", f.busca);
  if (f.pais) q.set("pais", f.pais);
  if (f.turma) q.set("turma", f.turma);
  return q.toString();
}

export const hrefFila = (f: FiltrosFila) => {
  const q = filtrosFilaParaQuery(f);
  return q ? `${ROTA_FILA}?${q}` : ROTA_FILA;
};

export const temBuscaFila = (f: FiltrosFila) => !!(f.busca || f.pais || f.turma);

export const hrefIndicador = (f: FiltrosFila, indicador: IndicadorFila) =>
  hrefFila({ ...f, indicador: f.indicador === indicador ? null : indicador });

export const hrefSemIndicador = (f: FiltrosFila) => hrefFila({ ...f, indicador: null });

export const hrefSemBusca = (f: FiltrosFila) => hrefFila({ ...lerFiltrosFila({}), indicador: f.indicador });

export type CamposFila = { busca: string; pais: string; turma: string };
export const camposDosFiltrosFila = (f: FiltrosFila): CamposFila => ({ busca: f.busca, pais: f.pais ?? "", turma: f.turma ?? "" });

export const hrefDosCamposFila = (c: CamposFila, indicador: IndicadorFila | null = null) =>
  hrefFila({ ...lerFiltrosFila({ busca: c.busca, pais: c.pais, turma: c.turma }), indicador });

export const palavrasDaBuscaFila = (busca: string) => busca.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);

type ItemIndicador = Pick<FilaCobrancaItem, "estado" | "diasAtraso" | "precisaBloqueio">;
type ItemFiltravel = ItemIndicador & Pick<FilaCobrancaItem, "codigo" | "pais" | "turma" | "prioridade"> & {
  aluno: { nome: string };
};

const DO_INDICADOR: Record<IndicadorFila, (i: ItemIndicador) => boolean> = {
  aVencer: (i) => i.estado !== "promessa" && i.diasAtraso <= 0,
  emAtraso: (i) => i.estado !== "promessa" && i.diasAtraso > 0,
  bloquear: (i) => i.precisaBloqueio,
  promessas: (i) => i.estado === "promessa",
};

export function contarIndicadoresFila(itens: ItemIndicador[]): Record<IndicadorFila, number> {
  const conta = (indicador: IndicadorFila) => itens.filter(DO_INDICADOR[indicador]).length;
  return { aVencer: conta("aVencer"), emAtraso: conta("emAtraso"), bloquear: conta("bloquear"), promessas: conta("promessas") };
}

export type ChaveOrdemFila = { prioridade: number; diasAtraso: number; id: string };

export function compararFila(a: ChaveOrdemFila, b: ChaveOrdemFila): number {
  return a.prioridade - b.prioridade || b.diasAtraso - a.diasAtraso || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function filtrarFila<T extends ItemFiltravel & { id: string }>(itens: T[], f: FiltrosFila): T[] {
  const palavras = palavrasDaBuscaFila(f.busca);
  return itens
    .filter((i) => !f.indicador || DO_INDICADOR[f.indicador](i))
    .filter((i) => palavras.every((p) => i.aluno.nome.toLowerCase().includes(p) || (i.codigo ?? "").toLowerCase().includes(p)))
    .filter((i) => !f.pais || i.pais === f.pais)
    .filter((i) => !f.turma || i.turma === f.turma)
    .sort(compararFila);
}

export const cursorDoItemFila = (i: ChaveOrdemFila): string => `${i.prioridade}_${i.diasAtraso}_${i.id}`;

export function lerCursorFila(cursor: string): ChaveOrdemFila | null {
  const m = /^(-?\d{1,6})_(-?\d{1,6})_([A-Za-z0-9-]{1,80})$/.exec(cursor);
  return m ? { prioridade: Number(m[1]), diasAtraso: Number(m[2]), id: m[3] } : null;
}

export function navegacaoDaFilaValida(nav: NavegacaoFila): boolean {
  const cursor = nav.depois ?? nav.antes;
  return cursor === undefined || lerCursorFila(cursor) !== null;
}

export function trechoDaFila<T extends ChaveOrdemFila>(ordenados: readonly T[], nav: NavegacaoFila, take: number): T[] {
  const cursor = nav.depois ?? nav.antes;
  if (cursor === undefined) return ordenados.slice(0, take);
  const chave = lerCursorFila(cursor);
  if (!chave) return [];
  if (nav.antes !== undefined) return ordenados.filter((i) => compararFila(i, chave) < 0).reverse().slice(0, take);
  return ordenados.filter((i) => compararFila(i, chave) > 0).slice(0, take);
}

export function hrefFilaNoCursor(f: FiltrosFila, cursor: CursorDoLink): string {
  const q = new URLSearchParams(filtrosFilaParaQuery(f));
  if ("antes" in cursor) q.set("antes", cursor.antes);
  else q.set("depois", cursor.depois);
  return `${ROTA_FILA}?${q.toString()}`;
}

export function opcoesDaFila(itens: Pick<FilaCobrancaItem, "pais" | "turma">[], f: FiltrosFila): { paises: string[]; turmas: string[] } {
  const unicos = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();
  return { paises: unicos([...itens.map((i) => i.pais), f.pais]), turmas: unicos([...itens.map((i) => i.turma), f.turma]) };
}
