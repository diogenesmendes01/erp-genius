import { z } from "zod";
import type { ParametrosUrl } from "./pagina-url";

export type Direcao = "asc" | "desc";

export type NavegacaoFila = { depois?: string; antes?: string };

export type NavegacaoDaPagina = { temAnterior: boolean; temProxima: boolean; anterior: string | null; proxima: string | null };

export type PaginaDaFila<T> = NavegacaoDaPagina & { registros: T[] };

export const CURSOR_FILA = /^[A-Za-z0-9_-]{1,100}$/;

export const MENSAGEM_CURSOR_INVALIDO = "Cursor de navegação inválido. Volte ao início da fila.";
export const MENSAGEM_DOIS_SENTIDOS = "Use um sentido de navegação por vez (antes ou depois).";

const cursor = z.string().regex(CURSOR_FILA, MENSAGEM_CURSOR_INVALIDO);

export const camposNavegacaoFila = { depois: cursor.optional(), antes: cursor.optional() };

export const umSentido = (d: NavegacaoFila) => !(d.depois !== undefined && d.antes !== undefined);

const navegacaoSchema = z.object(camposNavegacaoFila).strict().refine(umSentido, MENSAGEM_DOIS_SENTIDOS);

export function validarNavegacao(nav: NavegacaoFila): { ok: true; nav: NavegacaoFila } | { ok: false; erro: string } {
  const r = navegacaoSchema.safeParse(nav);
  return r.success ? { ok: true, nav: r.data } : { ok: false, erro: r.error.errors[0]?.message ?? MENSAGEM_CURSOR_INVALIDO };
}

function valor(p: ParametrosUrl, chave: string): string {
  const v = p[chave];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

export function lerNavegacao(p: ParametrosUrl, sufixo = ""): NavegacaoFila {
  const depois = valor(p, `depois${sufixo}`), antes = valor(p, `antes${sufixo}`);
  return { ...(depois ? { depois } : {}), ...(antes ? { antes } : {}) };
}

export const cursorDaLeitura = (nav: NavegacaoFila): string | null => nav.depois ?? nav.antes ?? null;

export function direcaoDeLeitura(nav: NavegacaoFila): (d: Direcao) => Direcao {
  return (d) => (nav.antes !== undefined ? (d === "asc" ? "desc" : "asc") : d);
}

export function alemDoCursor<T>(nav: NavegacaoFila, d: Direcao, valorDoCursor: T): { gt?: T; lt?: T } {
  return direcaoDeLeitura(nav)(d) === "asc" ? { gt: valorDoCursor } : { lt: valorDoCursor };
}

export function corteDoId(nav: NavegacaoFila, d: Direcao): { id?: { gt?: string; lt?: string } } {
  const c = cursorDaLeitura(nav);
  return c === null ? {} : { id: alemDoCursor(nav, d, c) };
}

export function recorteDaFila<T>(lidos: readonly T[], porPagina: number, nav: NavegacaoFila, idDe: (registro: T) => string): PaginaDaFila<T> {
  const mais = lidos.length > porPagina;
  const registros = lidos.slice(0, porPagina);
  if (nav.antes !== undefined) registros.reverse();
  if (!registros.length) return { registros, temAnterior: false, temProxima: false, anterior: null, proxima: null };
  const temAnterior = nav.antes !== undefined ? mais : nav.depois !== undefined;
  const temProxima = nav.antes !== undefined ? true : mais;
  return {
    registros, temAnterior, temProxima,
    anterior: temAnterior ? idDe(registros[0]) : null,
    proxima: temProxima ? idDe(registros[registros.length - 1]) : null,
  };
}

export async function lerPaginaDaFila<T>(nav: NavegacaoFila, porPagina: number, ler: (nav: NavegacaoFila, take: number) => Promise<T[]>, idDe: (registro: T) => string): Promise<PaginaDaFila<T>> {
  const lidos = await ler(nav, porPagina + 1);
  if (nav.antes !== undefined && lidos.length <= porPagina) return recorteDaFila(await ler({}, porPagina + 1), porPagina, {}, idDe);
  return recorteDaFila(lidos, porPagina, nav, idDe);
}
