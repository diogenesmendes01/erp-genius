// Paginação e filtros simples na URL para páginas de servidor (docs/42-auditoria-frontend-ux.md, E4):
// listas que cortavam num teto mudo (/secretaria em 40, /carteiras em 100) ou não tinham teto algum
// (/comissoes). Formulário GET puro (funciona sem JavaScript) + <Paginacao/> com links reais.
// Módulo puro, testável.

export type ParametrosUrl = Record<string, string | string[] | undefined>;

function valor(p: ParametrosUrl, chave: string): string {
  const v = p[chave];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

/** Página da URL: inteiro 1..100000; qualquer outra coisa vira 1. */
export function lerPagina(p: ParametrosUrl): number {
  const n = Number(valor(p, "pagina") || 1);
  return Number.isInteger(n) && n >= 1 && n <= 100000 ? n : 1;
}

/** Texto livre da URL (busca), sem espaços nas pontas e com teto de tamanho. */
export const lerTexto = (p: ParametrosUrl, chave: string, max = 100) => valor(p, chave).slice(0, max);

/** Valor da URL só se for uma das opções aceitas; senão null. */
export function lerOpcao<T extends string>(p: ParametrosUrl, chave: string, opcoes: readonly T[]): T | null {
  const v = valor(p, chave);
  return (opcoes as readonly string[]).includes(v) ? (v as T) : null;
}

/** Link da lista com os parâmetros preenchidos (vazios e página 1 ficam de fora). */
export function hrefLista(base: string, params: Record<string, string | number | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "") continue;
    if (k === "pagina" && Number(v) <= 1) continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

/** Faixa exibida ("X–Y de N") e se há página seguinte. */
export function faixaDaPagina(pagina: number, porPagina: number, naPagina: number, total: number) {
  const inicio = total && naPagina ? (pagina - 1) * porPagina + 1 : 0;
  const fim = (pagina - 1) * porPagina + naPagina;
  return { inicio, fim, temProxima: fim < total };
}

/** Página além do fim (link antigo, filtro que encolheu): número da última que existe; null se a página é válida. */
export function paginaAlemDoFim(pagina: number, porPagina: number, total: number): number | null {
  const ultima = Math.max(1, Math.ceil(total / porPagina));
  return pagina > ultima ? ultima : null;
}
