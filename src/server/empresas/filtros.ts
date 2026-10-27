import type { Prisma } from "@prisma/client";
import { anexarOrdenacao, lerOrdenacao, orderByDe, parametrosDaQuery, type CriteriosOrdenacao, type Ordenacao } from "@/lib/ordenacao";

export const EMPRESAS_POR_PAGINA = 50;

export type SituacaoEmpresa = "ativas" | "inativas";

export const ORDENS_EMPRESAS = ["codigo", "nome", "colaboradores", "situacao"] as const;
export type OrdemEmpresas = (typeof ORDENS_EMPRESAS)[number];
export const ORDEM_PADRAO_EMPRESAS: Ordenacao<OrdemEmpresas> | null = null;

export type FiltrosEmpresas = {
  busca: string;
  situacao: SituacaoEmpresa | null;
  paisId: string | null;
  pagina: number;
  ordem: Ordenacao<OrdemEmpresas> | null;
};

type Parametros = Record<string, string | string[] | undefined> | URLSearchParams;

function valor(p: Parametros, chave: string): string {
  const v = p instanceof URLSearchParams ? p.get(chave) : p[chave];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

export function lerFiltrosEmpresas(p: Parametros): FiltrosEmpresas {
  const situacao = valor(p, "situacao");
  const pais = valor(p, "pais");
  const pagina = Number(valor(p, "pagina") || 1);
  return {
    busca: valor(p, "busca").slice(0, 100),
    situacao: situacao === "ativas" || situacao === "inativas" ? situacao : null,
    paisId: pais && pais.length <= 64 && /^[\w-]+$/.test(pais) ? pais : null,
    pagina: Number.isInteger(pagina) && pagina >= 1 && pagina <= 100000 ? pagina : 1,
    ordem: lerOrdenacao(p, ORDENS_EMPRESAS, ORDEM_PADRAO_EMPRESAS),
  };
}

export function filtrosEmpresasParaQuery(f: FiltrosEmpresas, { semPagina = false } = {}): string {
  const q = new URLSearchParams();
  if (f.busca) q.set("busca", f.busca);
  if (f.situacao) q.set("situacao", f.situacao);
  if (f.paisId) q.set("pais", f.paisId);
  anexarOrdenacao(q, f.ordem, ORDEM_PADRAO_EMPRESAS);
  if (!semPagina && f.pagina > 1) q.set("pagina", String(f.pagina));
  return q.toString();
}

export const temFiltroEmpresas = (f: FiltrosEmpresas) => !!(f.busca || f.situacao || f.paisId);

const ORDEM_CADASTRO: Prisma.EmpresaOrderByWithRelationInput[] = [{ criadoEm: "desc" }, { id: "desc" }];
const POR_NOME: Prisma.EmpresaOrderByWithRelationInput[] = [{ nomeOrdenacao: "asc" }, { id: "asc" }];
const CRITERIOS_EMPRESAS: CriteriosOrdenacao<OrdemEmpresas, Prisma.EmpresaOrderByWithRelationInput> = {
  codigo: (dir) => [{ codigo: { sort: dir, nulls: "last" } }, { id: dir }],
  nome: (dir) => [{ nomeOrdenacao: dir }, { id: dir }],
  colaboradores: (dir) => [{ matriculas: { _count: dir } }, ...POR_NOME],
  situacao: (dir) => [{ ativo: dir === "asc" ? "desc" : "asc" }, ...POR_NOME],
};

export const orderByEmpresas = (o: Ordenacao<OrdemEmpresas> | null) => orderByDe(o, CRITERIOS_EMPRESAS, ORDEM_CADASTRO);

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

export function sanearFiltrosEmpresas(f: FiltrosEmpresas, opcoes: { paises: { id: string }[] }): FiltrosEmpresas {
  return { ...f, paisId: opcoes.paises.some((p) => p.id === f.paisId) ? f.paisId : null };
}

export const hrefEmpresas = (f: FiltrosEmpresas) => {
  const q = filtrosEmpresasParaQuery(f);
  return q ? `/empresas?${q}` : "/empresas";
};

export function destinoPaginaEmpresas(f: FiltrosEmpresas, total: number): string | null {
  const ultima = Math.max(1, Math.ceil(total / EMPRESAS_POR_PAGINA));
  return f.pagina > ultima ? hrefEmpresas({ ...f, pagina: ultima }) : null;
}

export type CamposEmpresas = { busca: string; situacao: string; pais: string };
export const camposDosFiltrosEmpresas = (f: FiltrosEmpresas): CamposEmpresas =>
  ({ busca: f.busca, situacao: f.situacao ?? "", pais: f.paisId ?? "" });

export const hrefDosCamposEmpresas = (c: CamposEmpresas, ordem: Ordenacao<OrdemEmpresas> | null = ORDEM_PADRAO_EMPRESAS) =>
  hrefEmpresas({ ...lerFiltrosEmpresas({ busca: c.busca, situacao: c.situacao, pais: c.pais }), ordem });

export const parametrosFiltrosEmpresas = (f: FiltrosEmpresas) =>
  parametrosDaQuery(filtrosEmpresasParaQuery({ ...f, ordem: ORDEM_PADRAO_EMPRESAS }, { semPagina: true }));
