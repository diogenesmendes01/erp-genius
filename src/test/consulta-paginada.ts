// Apoio dos testes das consultas numeradas (E4, paginação nos dois sentidos): um `findMany` de mentira
// sobre uma lista, que ordena por `orderBy` e aplica `skip`/`take` como o Prisma. Com ele, o teste lê a
// página 1, a 2 e volta à 1, e confere que a volta traz os mesmos registros (ordem estável, desempate
// pelo id), que a primeira página não tem anterior e que a última não tem próxima.
//
// LIMITE (de propósito): `where` (em `findManyOrdenado`), `select` e `cursor` são ignorados — o teste entrega
// só as linhas que o filtro deixaria passar. A ordem aceita só campos do próprio registro
// (`{ criadoEm: "desc" }`), não de relação. `findManyComOnde` (filas por cursor, abaixo) avalia o `where`.

type Direcao = "asc" | "desc";
type Ordem = Record<string, Direcao>;
export type ArgsPaginados = { where?: unknown; orderBy?: Ordem | Ordem[]; skip?: number; take?: number };

function comparar(x: unknown, y: unknown): number {
  const a = x instanceof Date ? x.getTime() : x, b = y instanceof Date ? y.getTime() : y;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const s = String(a), t = String(b);
  return s < t ? -1 : s > t ? 1 : 0;
}

/** As ordens de `orderBy`, na ordem em que o Prisma as aplica. */
export function ordensDe(orderBy: ArgsPaginados["orderBy"]): [string, Direcao][] {
  if (orderBy === undefined) return [];
  return (Array.isArray(orderBy) ? orderBy : [orderBy]).flatMap((o) => Object.entries(o));
}

/** A ordem termina no `id` (desempate estável: dois registros nunca empatam). */
export function terminaNoId(orderBy: ArgsPaginados["orderBy"]): boolean {
  const ordens = ordensDe(orderBy);
  return ordens.length > 0 && ordens[ordens.length - 1][0] === "id";
}

/** `findMany` de mentira sobre `linhas`: ordena por `orderBy` e aplica `skip`/`take`. */
export function findManyOrdenado<T extends Record<string, unknown>>(linhas: readonly T[]) {
  return async (args: ArgsPaginados = {}): Promise<T[]> => {
    const ordens = ordensDe(args.orderBy);
    const ordenadas = [...linhas].sort((a, b) => {
      for (const [campo, direcao] of ordens) {
        const c = comparar(a[campo], b[campo]);
        if (c) return direcao === "asc" ? c : -c;
      }
      return 0;
    });
    const inicio = args.skip ?? 0;
    return ordenadas.slice(inicio, args.take === undefined ? undefined : inicio + args.take);
  };
}

// Filas por cursor (E4, decisão de 10/10/2026): o corte do cursor vai no `where` (`{ id: { gt } }`, ou o par
// `OR: [{ criadoEm: { lt } }, { criadoEm, id: { lt } }]`). `atende` avalia esse pedaço; o resto do filtro
// continua fora do alcance, como acima (o teste entrega só as linhas que a fila mostraria agora — e "resolver"
// um item é tirá-lo da lista).

const COMPARACOES = new Set(["gt", "gte", "lt", "lte", "equals", "in"]);

/**
 * O registro atende ao `where`? Avalia `AND`, `OR`, igualdade, comparação (`gt`/`gte`/`lt`/`lte`/`equals`/`in`) e
 * relação opcional contra nulo (`{ is: null }`/`{ isNot: null }`) em campos do próprio registro. O que não se avalia
 * aqui — relação com filtro (`some`, `is: {…}`…), `NOT`, campo que a linha de teste não tem — conta como atendido.
 */
export function atende(registro: Record<string, unknown>, where: unknown): boolean {
  if (!where || typeof where !== "object") return true;
  for (const [chave, condicao] of Object.entries(where as Record<string, unknown>)) {
    if (condicao === undefined || chave === "NOT") continue;
    if (chave === "AND") {
      if (!(Array.isArray(condicao) ? condicao : [condicao]).every((c) => atende(registro, c))) return false;
      continue;
    }
    if (chave === "OR") {
      if (Array.isArray(condicao) && !condicao.some((c) => atende(registro, c))) return false;
      continue;
    }
    if (!(chave in registro)) continue;
    const valor = registro[chave];
    if (condicao === null || typeof condicao !== "object" || condicao instanceof Date) {
      if (comparar(valor, condicao) !== 0) return false;
      continue;
    }
    const filtro = condicao as Record<string, unknown>;
    // Relação opcional comparada com nulo (`{ is: null }`/`{ isNot: null }`): avaliável no próprio registro.
    if (Object.keys(filtro).length === 1 && "is" in filtro && filtro.is === null) { if (valor !== null) return false; continue; }
    if (Object.keys(filtro).length === 1 && "isNot" in filtro && filtro.isNot === null) { if (valor === null) return false; continue; }
    if (!Object.keys(filtro).every((k) => COMPARACOES.has(k))) continue;
    for (const [op, alvo] of Object.entries(filtro)) {
      if (alvo === undefined) continue;
      const c = op === "in" ? null : comparar(valor, alvo);
      if (op === "gt" && !(c! > 0)) return false;
      if (op === "gte" && !(c! >= 0)) return false;
      if (op === "lt" && !(c! < 0)) return false;
      if (op === "lte" && !(c! <= 0)) return false;
      if (op === "equals" && c !== 0) return false;
      if (op === "in" && !(alvo as unknown[]).some((a) => comparar(valor, a) === 0)) return false;
    }
  }
  return true;
}

/** `findMany` de mentira que também aplica o corte do cursor (`atende`) antes de ordenar e recortar. `linhas` é lida a
 * cada chamada: tirar uma linha da lista (`splice`) é resolver o item. */
export function findManyComOnde<T extends Record<string, unknown>>(linhas: T[]) {
  return async (args: ArgsPaginados = {}): Promise<T[]> => findManyOrdenado(linhas.filter((l) => atende(l, args.where)))(args);
}

/** `findUnique`/`findFirst` de mentira por id sobre todas as linhas (as já resolvidas também: a âncora do cursor continua existindo). */
export function buscarPorId<T extends Record<string, unknown> & { id: string }>(todas: readonly T[]) {
  return async (args: { where?: unknown } = {}): Promise<T | null> => todas.find((l) => atende(l, args.where)) ?? null;
}

/** Ids com zeros à esquerda (ordem de texto = ordem numérica): "r00", "r01"… */
export const idsEmOrdem = (quantidade: number, prefixo = "r") => Array.from({ length: quantidade }, (_, i) => `${prefixo}${String(i).padStart(2, "0")}`);
