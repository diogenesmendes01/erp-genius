type Direcao = "asc" | "desc";
type Ordem = Record<string, Direcao>;
export type ArgsPaginados = { where?: unknown; orderBy?: Ordem | Ordem[]; skip?: number; take?: number };

function comparar(x: unknown, y: unknown): number {
  const a = x instanceof Date ? x.getTime() : x, b = y instanceof Date ? y.getTime() : y;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const s = String(a), t = String(b);
  return s < t ? -1 : s > t ? 1 : 0;
}

export function ordensDe(orderBy: ArgsPaginados["orderBy"]): [string, Direcao][] {
  if (orderBy === undefined) return [];
  return (Array.isArray(orderBy) ? orderBy : [orderBy]).flatMap((o) => Object.entries(o));
}

export function terminaNoId(orderBy: ArgsPaginados["orderBy"]): boolean {
  const ordens = ordensDe(orderBy);
  return ordens.length > 0 && ordens[ordens.length - 1][0] === "id";
}

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

const COMPARACOES = new Set(["gt", "gte", "lt", "lte", "equals", "in"]);

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

export function findManyComOnde<T extends Record<string, unknown>>(linhas: T[]) {
  return async (args: ArgsPaginados = {}): Promise<T[]> => findManyOrdenado(linhas.filter((l) => atende(l, args.where)))(args);
}

export function buscarPorId<T extends Record<string, unknown> & { id: string }>(todas: readonly T[]) {
  return async (args: { where?: unknown } = {}): Promise<T | null> => todas.find((l) => atende(l, args.where)) ?? null;
}

export const idsEmOrdem = (quantidade: number, prefixo = "r") => Array.from({ length: quantidade }, (_, i) => `${prefixo}${String(i).padStart(2, "0")}`);
