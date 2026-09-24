import type { Prisma } from "@prisma/client";

// Filtros da lista de empresas na URL (docs/42-auditoria-frontend-ux.md, E4): a lista não tinha
// busca, filtro nem limite — carregava todas as empresas com contagens a cada visita. Mesmo desenho
// das listas de alunos e leads. Módulo puro: sem Prisma client, testável.

export const EMPRESAS_POR_PAGINA = 50;

export type SituacaoEmpresa = "ativas" | "inativas";

export type FiltrosEmpresas = {
  busca: string;
  situacao: SituacaoEmpresa | null;
  paisId: string | null;
  pagina: number;
};

type Parametros = Record<string, string | string[] | undefined> | URLSearchParams;

function valor(p: Parametros, chave: string): string {
  const v = p instanceof URLSearchParams ? p.get(chave) : p[chave];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

/** Lê e valida: busca até 100 caracteres; situação conhecida; id curto; página inteira 1..100000. Resto é ignorado. */
export function lerFiltrosEmpresas(p: Parametros): FiltrosEmpresas {
  const situacao = valor(p, "situacao");
  const pais = valor(p, "pais");
  const pagina = Number(valor(p, "pagina") || 1);
  return {
    busca: valor(p, "busca").slice(0, 100),
    situacao: situacao === "ativas" || situacao === "inativas" ? situacao : null,
    paisId: pais && pais.length <= 64 && /^[\w-]+$/.test(pais) ? pais : null,
    pagina: Number.isInteger(pagina) && pagina >= 1 && pagina <= 100000 ? pagina : 1,
  };
}

/** Query string dos filtros (sem os vazios e sem a página 1). */
export function filtrosEmpresasParaQuery(f: FiltrosEmpresas, { semPagina = false } = {}): string {
  const q = new URLSearchParams();
  if (f.busca) q.set("busca", f.busca);
  if (f.situacao) q.set("situacao", f.situacao);
  if (f.paisId) q.set("pais", f.paisId);
  if (!semPagina && f.pagina > 1) q.set("pagina", String(f.pagina));
  return q.toString();
}

export const temFiltroEmpresas = (f: FiltrosEmpresas) => !!(f.busca || f.situacao || f.paisId);

/** Condição dos filtros. Busca por palavras: cada uma no nome ou no código. */
export function whereFiltrosEmpresas(f: FiltrosEmpresas): Prisma.EmpresaWhereInput {
  const e: Prisma.EmpresaWhereInput[] = [];
  for (const palavra of f.busca.split(/\s+/).filter(Boolean).slice(0, 6)) {
    const contem = { contains: palavra, mode: "insensitive" as const };
    e.push({ OR: [{ nome: contem }, { codigo: contem }] });
  }
  if (f.situacao) e.push({ ativo: f.situacao === "ativas" });
  if (f.paisId) e.push({ paisId: f.paisId });
  return e.length ? { AND: e } : {};
}

/** País que não está mais nas opções (link salvo) é descartado — senão o select mostraria "Todos" e a lista viria vazia. */
export function sanearFiltrosEmpresas(f: FiltrosEmpresas, opcoes: { paises: { id: string }[] }): FiltrosEmpresas {
  return { ...f, paisId: opcoes.paises.some((p) => p.id === f.paisId) ? f.paisId : null };
}

/** Link da lista com estes filtros ("/empresas" quando não há nenhum). */
export const hrefEmpresas = (f: FiltrosEmpresas) => {
  const q = filtrosEmpresasParaQuery(f);
  return q ? `/empresas?${q}` : "/empresas";
};

/** Página além do fim: destino da última página que existe; null se a página é válida. */
export function destinoPaginaEmpresas(f: FiltrosEmpresas, total: number): string | null {
  const ultima = Math.max(1, Math.ceil(total / EMPRESAS_POR_PAGINA));
  return f.pagina > ultima ? hrefEmpresas({ ...f, pagina: ultima }) : null;
}

export type CamposEmpresas = { busca: string; situacao: string; pais: string };
export const camposDosFiltrosEmpresas = (f: FiltrosEmpresas): CamposEmpresas =>
  ({ busca: f.busca, situacao: f.situacao ?? "", pais: f.paisId ?? "" });

/** Link a partir dos campos do formulário — mesmo leitor/validação da página; volta à página 1. */
export const hrefDosCamposEmpresas = (c: CamposEmpresas) => hrefEmpresas(lerFiltrosEmpresas({ ...c }));
