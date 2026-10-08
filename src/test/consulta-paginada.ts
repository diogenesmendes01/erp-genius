// Apoio dos testes das consultas numeradas (E4, paginação nos dois sentidos): um `findMany` de mentira
// sobre uma lista, que ordena por `orderBy` e aplica `skip`/`take` como o Prisma. Com ele, o teste lê a
// página 1, a 2 e volta à 1, e confere que a volta traz os mesmos registros (ordem estável, desempate
// pelo id), que a primeira página não tem anterior e que a última não tem próxima.
//
// LIMITE (de propósito): `where`, `select` e `cursor` são ignorados — o teste entrega só as linhas que o
// filtro deixaria passar. A ordem aceita só campos do próprio registro (`{ criadoEm: "desc" }`), não de
// relação.

type Direcao = "asc" | "desc";
type Ordem = Record<string, Direcao>;
export type ArgsPaginados = { orderBy?: Ordem | Ordem[]; skip?: number; take?: number };

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

/** Ids com zeros à esquerda (ordem de texto = ordem numérica): "r00", "r01"… */
export const idsEmOrdem = (quantidade: number, prefixo = "r") => Array.from({ length: quantidade }, (_, i) => `${prefixo}${String(i).padStart(2, "0")}`);
