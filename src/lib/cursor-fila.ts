// Filas de trabalho com cursor nos dois sentidos (E4, decisão de 10/10/2026). Módulo irmão de
// pagina-url.ts: as listas e os históricos continuam com página numerada (`janelaDaPagina`/
// `recorteDaPagina`); as FILAS — pendências que somem quando alguém age nelas — andam por cursor.
//
// Por que cursor: na página numerada, quem resolve itens da página 1 desloca a página 2 (o 21º sobe
// para a página 1) e quem avança para a 2 pula esse registro. O cursor guarda o id do último item
// visto (`depois`) ou do primeiro (`antes`), e a leitura continua a partir dele, na ordem estável da
// fila (que termina sempre no id): resolver um item já visto não muda o que vem depois.
//
// O cursor é o id de um item: validado (CURSOR_FILA) e nunca interpretado como página. Cursor com
// formato inválido é erro da consulta; cursor que não leva a nada (item sumido, fim da fila) devolve
// a fila vazia daquele ponto, e a tela oferece a volta ao início.
import { z } from "zod";
import type { ParametrosUrl } from "./pagina-url";

/** Direção de uma coluna de ordem. */
export type Direcao = "asc" | "desc";

/** Sentido da leitura: a partir do início, depois do último item visto ou antes do primeiro. */
export type NavegacaoFila = { depois?: string; antes?: string };

/** O que a tela recebe para navegar: há página antes/depois e o cursor de cada lado (null quando não há). */
export type NavegacaoDaPagina = { temAnterior: boolean; temProxima: boolean; anterior: string | null; proxima: string | null };

export type PaginaDaFila<T> = NavegacaoDaPagina & { registros: T[] };

/** Formato do cursor (id de cuid/uuid/código interno): letras, dígitos, `_` e `-`, até 100. */
export const CURSOR_FILA = /^[A-Za-z0-9_-]{1,100}$/;

export const MENSAGEM_CURSOR_INVALIDO = "Cursor de navegação inválido. Volte ao início da fila.";
export const MENSAGEM_DOIS_SENTIDOS = "Use um sentido de navegação por vez (antes ou depois).";

const cursor = z.string().regex(CURSOR_FILA, MENSAGEM_CURSOR_INVALIDO);

/** Campos de navegação de uma consulta de fila (`depois`/`antes`), para espalhar no `z.object`. */
export const camposNavegacaoFila = { depois: cursor.optional(), antes: cursor.optional() };

/** Um sentido por vez: `depois` e `antes` juntos não dizem para onde ir. */
export const umSentido = (d: NavegacaoFila) => !(d.depois !== undefined && d.antes !== undefined);

const navegacaoSchema = z.object(camposNavegacaoFila).strict().refine(umSentido, MENSAGEM_DOIS_SENTIDOS);

/** Validação para a fila consultada na própria página (sem action no meio): cursor fora do formato é erro. */
export function validarNavegacao(nav: NavegacaoFila): { ok: true; nav: NavegacaoFila } | { ok: false; erro: string } {
  const r = navegacaoSchema.safeParse(nav);
  return r.success ? { ok: true, nav: r.data } : { ok: false, erro: r.error.errors[0]?.message ?? MENSAGEM_CURSOR_INVALIDO };
}

function valor(p: ParametrosUrl, chave: string): string {
  const v = p[chave];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

/** Cursor da URL (`depois`/`antes`, ou `depoisX`/`antesX` de um segundo painel com `sufixo`), sem validar: a consulta valida. */
export function lerNavegacao(p: ParametrosUrl, sufixo = ""): NavegacaoFila {
  const depois = valor(p, `depois${sufixo}`), antes = valor(p, `antes${sufixo}`);
  return { ...(depois ? { depois } : {}), ...(antes ? { antes } : {}) };
}

/** O cursor da leitura (o de `depois` ou o de `antes`), ou null no início da fila. */
export const cursorDaLeitura = (nav: NavegacaoFila): string | null => nav.depois ?? nav.antes ?? null;

/** Ao ler para trás (`antes`), cada coluna de ordem se inverte; o recorte desvira no fim. */
export function direcaoDeLeitura(nav: NavegacaoFila): (d: Direcao) => Direcao {
  return (d) => (nav.antes !== undefined ? (d === "asc" ? "desc" : "asc") : d);
}

/** Limite estrito a partir do cursor numa coluna de direção `d`: depois de "asc" é `gt`, antes de "asc" é `lt` (e o contrário em "desc"). */
export function alemDoCursor<T>(nav: NavegacaoFila, d: Direcao, valorDoCursor: T): { gt?: T; lt?: T } {
  return direcaoDeLeitura(nav)(d) === "asc" ? { gt: valorDoCursor } : { lt: valorDoCursor };
}

/** Corte de uma fila ordenada só pelo id (`{ id: { gt } }`/`{ id: { lt } }`); vazio no início. O id não precisa existir: é só a fronteira. */
export function corteDoId(nav: NavegacaoFila, d: Direcao): { id?: { gt?: string; lt?: string } } {
  const c = cursorDaLeitura(nav);
  return c === null ? {} : { id: alemDoCursor(nav, d, c) };
}

/**
 * A página da fila a partir do que a leitura trouxe (na ordem de leitura, com um registro a mais).
 * - início: os primeiros; sem anterior; próxima se leu a mais.
 * - depois: os seguintes ao cursor; anterior sempre (veio de uma página); próxima se leu a mais.
 * - antes: os anteriores ao cursor, desvirados; próxima sempre; anterior se leu a mais.
 * Página vazia não tem navegação: a tela oferece a volta ao início.
 */
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

/**
 * Lê uma página da fila. `ler(nav, take)` consulta na ordem de leitura (`direcaoDeLeitura`), cortada
 * pelo cursor (`corteDoId`/`alemDoCursor`), com `take` registros. Ao voltar (`antes`) e chegar ao
 * começo, a página é a primeira: lida de novo do início, cheia e sem "Anterior" (a primeira página não
 * tem link para si).
 */
export async function lerPaginaDaFila<T>(nav: NavegacaoFila, porPagina: number, ler: (nav: NavegacaoFila, take: number) => Promise<T[]>, idDe: (registro: T) => string): Promise<PaginaDaFila<T>> {
  const lidos = await ler(nav, porPagina + 1);
  if (nav.antes !== undefined && lidos.length <= porPagina) return recorteDaFila(await ler({}, porPagina + 1), porPagina, {}, idDe);
  return recorteDaFila(lidos, porPagina, nav, idDe);
}
