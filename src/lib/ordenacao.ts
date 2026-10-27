export type Direcao = "asc" | "desc";

export type Ordenacao<C extends string = string> = { campo: C; dir: Direcao };

export const PARAMETRO_ORDEM = "ordem";
export const PARAMETRO_DIRECAO = "dir";

type Parametros = Record<string, string | string[] | undefined> | URLSearchParams;

function valor(p: Parametros, chave: string): string {
  const v = p instanceof URLSearchParams ? p.get(chave) : p[chave];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

export function lerOrdenacao<C extends string>(p: Parametros, campos: readonly C[], padrao: Ordenacao<C>): Ordenacao<C>;
export function lerOrdenacao<C extends string>(p: Parametros, campos: readonly C[], padrao: Ordenacao<C> | null): Ordenacao<C> | null;
export function lerOrdenacao<C extends string>(p: Parametros, campos: readonly C[], padrao: Ordenacao<C> | null): Ordenacao<C> | null {
  const campo = valor(p, PARAMETRO_ORDEM);
  if (!(campos as readonly string[]).includes(campo)) return padrao;
  return { campo: campo as C, dir: valor(p, PARAMETRO_DIRECAO) === "desc" ? "desc" : "asc" };
}

export const mesmaOrdenacao = (a: Ordenacao | null, b: Ordenacao | null) =>
  a === null || b === null ? a === b : a.campo === b.campo && a.dir === b.dir;

export function parametrosOrdenacao(o: Ordenacao | null, padrao: Ordenacao | null): { ordem: string | null; dir: Direcao | null } {
  if (!o || mesmaOrdenacao(o, padrao)) return { ordem: null, dir: null };
  return { ordem: o.campo, dir: o.dir };
}

export function anexarOrdenacao(q: URLSearchParams, o: Ordenacao | null, padrao: Ordenacao | null): URLSearchParams {
  const { ordem, dir } = parametrosOrdenacao(o, padrao);
  if (ordem && dir) {
    q.set(PARAMETRO_ORDEM, ordem);
    q.set(PARAMETRO_DIRECAO, dir);
  }
  return q;
}

export function proximaDirecao(atual: Ordenacao | null, campo: string, inicial: Direcao = "asc"): Direcao {
  if (atual?.campo === campo) return atual.dir === "asc" ? "desc" : "asc";
  return inicial;
}

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

export const parametrosDaQuery = (query: string): Record<string, string> => Object.fromEntries(new URLSearchParams(query));

export type CriteriosOrdenacao<C extends string, O> = Record<C, (dir: Direcao) => O[]>;

const temDesempatePorId = (criterios: object[]) =>
  criterios.some((c) => Object.keys(c).length === 1 && Object.prototype.hasOwnProperty.call(c, "id"));

export function orderByDe<C extends string, O extends object>(o: Ordenacao<C> | null, criterios: CriteriosOrdenacao<C, O>, padrao: O[]): O[] {
  const daColuna = o && Object.prototype.hasOwnProperty.call(criterios, o.campo) ? criterios[o.campo](o.dir) : null;
  const lista = daColuna ?? padrao;
  return temDesempatePorId(lista) ? lista : [...lista, { id: daColuna && o ? o.dir : "asc" } as unknown as O];
}
