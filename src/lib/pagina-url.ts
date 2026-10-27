export type ParametrosUrl = Record<string, string | string[] | undefined>;

function valor(p: ParametrosUrl, chave: string): string {
  const v = p[chave];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

export const PAGINA_MAXIMA = 100000;

const CHAVE_DE_PAGINA = /^pagina([A-Z]\w*)?$/;

export function lerPagina(p: ParametrosUrl, chave = "pagina"): number {
  const n = Number(valor(p, chave) || 1);
  return Number.isInteger(n) && n >= 1 && n <= PAGINA_MAXIMA ? n : 1;
}

export const lerTexto = (p: ParametrosUrl, chave: string, max = 100) => valor(p, chave).slice(0, max);

export function lerOpcao<T extends string>(p: ParametrosUrl, chave: string, opcoes: readonly T[]): T | null {
  const v = valor(p, chave);
  return (opcoes as readonly string[]).includes(v) ? (v as T) : null;
}

export function hrefLista(base: string, params: Record<string, string | number | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "") continue;
    if (CHAVE_DE_PAGINA.test(k) && Number(v) <= 1) continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

export function janelaDaPagina(pagina: number, porPagina: number): { skip: number; take: number } {
  return { skip: (pagina - 1) * porPagina, take: porPagina + 1 };
}

export function recorteDaPagina<T>(lidos: readonly T[], porPagina: number): { registros: T[]; temProxima: boolean } {
  return { registros: lidos.slice(0, porPagina), temProxima: lidos.length > porPagina };
}

export function faixaDaPagina(pagina: number, porPagina: number, naPagina: number, total: number) {
  const inicio = total && naPagina ? (pagina - 1) * porPagina + 1 : 0;
  const fim = (pagina - 1) * porPagina + naPagina;
  return { inicio, fim, temProxima: fim < total };
}

export function paginaAlemDoFim(pagina: number, porPagina: number, total: number): number | null {
  const ultima = Math.max(1, Math.ceil(total / porPagina));
  return pagina > ultima ? ultima : null;
}
