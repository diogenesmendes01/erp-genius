// Ordenação de listas pela URL (docs/42-auditoria-frontend-ux.md §5.6 A9 e E1 — `ColunaOrdenavel`).
// As listas são paginadas no servidor: ordenar só a página em memória mostraria uma ordem falsa (o
// primeiro da página 2 poderia vir antes do último da página 1). A ordem vai na URL (`ordem` e `dir`),
// é validada contra uma lista FECHADA de colunas de cada tela (valor fora dela → ordem padrão da tela)
// e vira `orderBy` com desempate final por `id`, para a paginação não pular nem repetir registros.
// Módulo puro (sem Prisma client, sem React): usado pelo servidor e pelo componente de cabeçalho.

export type Direcao = "asc" | "desc";

/** Coluna e direção da lista. `C` é a lista fechada de colunas ordenáveis da tela. */
export type Ordenacao<C extends string = string> = { campo: C; dir: Direcao };

/** Nomes dos parâmetros na URL. */
export const PARAMETRO_ORDEM = "ordem";
export const PARAMETRO_DIRECAO = "dir";

type Parametros = Record<string, string | string[] | undefined> | URLSearchParams;

function valor(p: Parametros, chave: string): string {
  const v = p instanceof URLSearchParams ? p.get(chave) : p[chave];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

/**
 * Ordem pedida na URL. `ordem` fora da lista fechada (ou ausente) → `padrao` — a ordem atual da tela;
 * `null` quando a ordem padrão não corresponde a nenhuma coluna (nenhum cabeçalho fica marcado).
 * `dir` ausente ou inválida → crescente.
 */
export function lerOrdenacao<C extends string>(p: Parametros, campos: readonly C[], padrao: Ordenacao<C>): Ordenacao<C>;
export function lerOrdenacao<C extends string>(p: Parametros, campos: readonly C[], padrao: Ordenacao<C> | null): Ordenacao<C> | null;
export function lerOrdenacao<C extends string>(p: Parametros, campos: readonly C[], padrao: Ordenacao<C> | null): Ordenacao<C> | null {
  const campo = valor(p, PARAMETRO_ORDEM);
  if (!(campos as readonly string[]).includes(campo)) return padrao;
  return { campo: campo as C, dir: valor(p, PARAMETRO_DIRECAO) === "desc" ? "desc" : "asc" };
}

export const mesmaOrdenacao = (a: Ordenacao | null, b: Ordenacao | null) =>
  a === null || b === null ? a === b : a.campo === b.campo && a.dir === b.dir;

/**
 * Parâmetros da ordem para montar links da lista (paginação, filtros, redirecionamento). Vazios quando
 * é a ordem padrão: sem ordenar, as URLs continuam exatamente as de antes.
 */
export function parametrosOrdenacao(o: Ordenacao | null, padrao: Ordenacao | null): { ordem: string | null; dir: Direcao | null } {
  if (!o || mesmaOrdenacao(o, padrao)) return { ordem: null, dir: null };
  return { ordem: o.campo, dir: o.dir };
}

/** Escreve a ordem (quando não é a padrão) numa query string já montada. */
export function anexarOrdenacao(q: URLSearchParams, o: Ordenacao | null, padrao: Ordenacao | null): URLSearchParams {
  const { ordem, dir } = parametrosOrdenacao(o, padrao);
  if (ordem && dir) {
    q.set(PARAMETRO_ORDEM, ordem);
    q.set(PARAMETRO_DIRECAO, dir);
  }
  return q;
}

/** Direção que o clique na coluna aplica: na coluna já ordenada, inverte; em outra, a direção inicial dela. */
export function proximaDirecao(atual: Ordenacao | null, campo: string, inicial: Direcao = "asc"): Direcao {
  if (atual?.campo === campo) return atual.dir === "asc" ? "desc" : "asc";
  return inicial;
}

/**
 * Link do cabeçalho: mesma rota, mesmos parâmetros (busca e filtros), nova ordem e de volta à página 1
 * — a página N de outra ordem é outro recorte. Funciona sem JavaScript (é um link comum).
 */
export function hrefOrdenacao(rota: string, parametros: Record<string, string>, o: Ordenacao): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(parametros)) {
    if (!v || k === "pagina" || k === PARAMETRO_ORDEM || k === PARAMETRO_DIRECAO) continue;
    q.set(k, v);
  }
  q.set(PARAMETRO_ORDEM, o.campo);
  q.set(PARAMETRO_DIRECAO, o.dir);
  return `${rota}?${q.toString()}`;
}

/** Query string → parâmetros (para passar os filtros atuais ao cabeçalho). */
export const parametrosDaQuery = (query: string): Record<string, string> => Object.fromEntries(new URLSearchParams(query));

/** Critérios de `orderBy` de cada coluna da lista fechada, em função da direção. */
export type CriteriosOrdenacao<C extends string, O> = Record<C, (dir: Direcao) => O[]>;

const temDesempatePorId = (criterios: object[]) =>
  criterios.some((c) => Object.keys(c).length === 1 && Object.prototype.hasOwnProperty.call(c, "id"));

/**
 * `orderBy` da consulta: os critérios da coluna pedida (ou `padrao`, quando não há ordem ou a coluna não
 * está na lista) com desempate final por `id`. Sem o desempate, registros empatados (mesmo nome, mesma
 * situação) não têm posição fixa no banco e podem trocar de página entre duas consultas.
 */
export function orderByDe<C extends string, O extends object>(o: Ordenacao<C> | null, criterios: CriteriosOrdenacao<C, O>, padrao: O[]): O[] {
  const daColuna = o && Object.prototype.hasOwnProperty.call(criterios, o.campo) ? criterios[o.campo](o.dir) : null;
  const lista = daColuna ?? padrao;
  return temDesempatePorId(lista) ? lista : [...lista, { id: daColuna && o ? o.dir : "asc" } as unknown as O];
}
