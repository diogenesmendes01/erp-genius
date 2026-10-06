import type { Prisma } from "@prisma/client";
import { anexarOrdenacao, lerOrdenacao, orderByDe, parametrosDaQuery, type CriteriosOrdenacao, type Ordenacao } from "@/lib/ordenacao";

// Filtros da lista de empresas na URL (docs/42-auditoria-frontend-ux.md, E4): a lista não tinha
// busca, filtro nem limite — carregava todas as empresas com contagens a cada visita. Mesmo desenho
// das listas de alunos e leads. Módulo puro: sem Prisma client, testável.

export const EMPRESAS_POR_PAGINA = 50;

export type SituacaoEmpresa = "ativas" | "inativas";

// Ordenação pelo cabeçalho (E1, §5.6 A9): lista fechada de colunas. País (a empresa guarda só o paisId,
// sem relação para ordenar pelo nome) e "Faturas a receber" (contagem filtrada por status, que o
// orderBy do Prisma não faz) ficam fora.
export const ORDENS_EMPRESAS = ["codigo", "nome", "colaboradores", "situacao"] as const;
export type OrdemEmpresas = (typeof ORDENS_EMPRESAS)[number];
/** Sem ordem na URL: a de sempre (cadastro mais recente primeiro), que não é coluna da tabela — nenhum cabeçalho marcado. */
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
    ordem: lerOrdenacao(p, ORDENS_EMPRESAS, ORDEM_PADRAO_EMPRESAS),
  };
}

/** Query string dos filtros (sem os vazios, sem a página 1 e sem a ordem padrão). */
export function filtrosEmpresasParaQuery(f: FiltrosEmpresas, { semPagina = false } = {}): string {
  const q = new URLSearchParams();
  if (f.busca) q.set("busca", f.busca);
  if (f.situacao) q.set("situacao", f.situacao);
  if (f.paisId) q.set("pais", f.paisId);
  anexarOrdenacao(q, f.ordem, ORDEM_PADRAO_EMPRESAS);
  if (!semPagina && f.pagina > 1) q.set("pagina", String(f.pagina));
  return q.toString();
}

/** Há filtro aplicado? A ordem não é filtro. */
export const temFiltroEmpresas = (f: FiltrosEmpresas) => !!(f.busca || f.situacao || f.paisId);

// A ordem de sempre: cadastro mais recente primeiro (id desempata empresas criadas no mesmo instante).
const ORDEM_CADASTRO: Prisma.EmpresaOrderByWithRelationInput[] = [{ criadoEm: "desc" }, { id: "desc" }];
const POR_NOME: Prisma.EmpresaOrderByWithRelationInput[] = [{ nome: "asc" }, { id: "asc" }];
const CRITERIOS_EMPRESAS: CriteriosOrdenacao<OrdemEmpresas, Prisma.EmpresaOrderByWithRelationInput> = {
  // Código é opcional: empresas sem código ficam no fim nas duas direções.
  codigo: (dir) => [{ codigo: { sort: dir, nulls: "last" } }, { id: dir }],
  nome: (dir) => [{ nome: dir }, { id: dir }],
  // A mesma contagem exibida na coluna (_count de matrículas), feita no banco.
  colaboradores: (dir) => [{ matriculas: { _count: dir } }, ...POR_NOME],
  // Pelo rótulo exibido: crescente = "Ativa" antes de "Inativa" (ativo = true primeiro).
  situacao: (dir) => [{ ativo: dir === "asc" ? "desc" : "asc" }, ...POR_NOME],
};

/** `orderBy` da lista: a coluna pedida, com desempate estável por id; sem ordem, a de cadastro. */
export const orderByEmpresas = (o: Ordenacao<OrdemEmpresas> | null) => orderByDe(o, CRITERIOS_EMPRESAS, ORDEM_CADASTRO);

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

/** Link a partir dos campos do formulário — mesmo leitor/validação da página; volta à página 1 e mantém a ordem atual. */
export const hrefDosCamposEmpresas = (c: CamposEmpresas, ordem: Ordenacao<OrdemEmpresas> | null = ORDEM_PADRAO_EMPRESAS) =>
  hrefEmpresas({ ...lerFiltrosEmpresas({ busca: c.busca, situacao: c.situacao, pais: c.pais }), ordem });

/** Busca e filtros atuais (sem página e sem ordem), para os links dos cabeçalhos ordenáveis. */
export const parametrosFiltrosEmpresas = (f: FiltrosEmpresas) =>
  parametrosDaQuery(filtrosEmpresasParaQuery({ ...f, ordem: ORDEM_PADRAO_EMPRESAS }, { semPagina: true }));
