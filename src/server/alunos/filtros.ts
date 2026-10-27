import { StatusAluno, type Prisma } from "@prisma/client";
import { anexarOrdenacao, lerOrdenacao, orderByDe, parametrosDaQuery, type CriteriosOrdenacao, type Ordenacao } from "@/lib/ordenacao";

export const ALUNOS_POR_PAGINA = 50;

export const ORDENS_ALUNOS = ["nome", "pais", "status"] as const;
export type OrdemAlunos = (typeof ORDENS_ALUNOS)[number];
export const ORDEM_PADRAO_ALUNOS: Ordenacao<OrdemAlunos> = { campo: "nome", dir: "asc" };

export type FiltrosAlunos = {
  busca: string;
  status: StatusAluno | null;
  paisId: string | null;
  turmaId: string | null;
  pagina: number;
  ordem: Ordenacao<OrdemAlunos>;
};

type Parametros = Record<string, string | string[] | undefined> | URLSearchParams;

function valor(p: Parametros, chave: string): string {
  const v = p instanceof URLSearchParams ? p.get(chave) : p[chave];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

export function lerFiltrosAlunos(p: Parametros): FiltrosAlunos {
  const status = valor(p, "status");
  const id = (v: string) => (v && v.length <= 64 && /^[\w-]+$/.test(v) ? v : null);
  const pagina = Number(valor(p, "pagina") || 1);
  return {
    busca: valor(p, "busca").slice(0, 100),
    status: (Object.values(StatusAluno) as string[]).includes(status) ? (status as StatusAluno) : null,
    paisId: id(valor(p, "pais")),
    turmaId: id(valor(p, "turma")),
    pagina: Number.isInteger(pagina) && pagina >= 1 && pagina <= 100000 ? pagina : 1,
    ordem: lerOrdenacao(p, ORDENS_ALUNOS, ORDEM_PADRAO_ALUNOS),
  };
}

export function filtrosParaQuery(f: FiltrosAlunos, { semPagina = false } = {}): string {
  const q = new URLSearchParams();
  if (f.busca) q.set("busca", f.busca);
  if (f.status) q.set("status", f.status);
  if (f.paisId) q.set("pais", f.paisId);
  if (f.turmaId) q.set("turma", f.turmaId);
  anexarOrdenacao(q, f.ordem, ORDEM_PADRAO_ALUNOS);
  if (!semPagina && f.pagina > 1) q.set("pagina", String(f.pagina));
  return q.toString();
}

export const palavrasDaBusca = (busca: string) => busca.split(/\s+/).filter(Boolean).slice(0, 6);

export const temFiltroAlunos = (f: FiltrosAlunos) => !!(f.busca || f.status || f.paisId || f.turmaId);

const POR_NOME: Prisma.AlunoOrderByWithRelationInput[] = [{ nomeOrdenacao: "asc" }, { id: "asc" }];
const CRITERIOS_ALUNOS: CriteriosOrdenacao<OrdemAlunos, Prisma.AlunoOrderByWithRelationInput> = {
  nome: (dir) => [{ nomeOrdenacao: dir }, { id: dir }],
  pais: (dir) => [{ pais: { nome: dir } }, ...POR_NOME],
  status: (dir) => [{ status: dir }, ...POR_NOME],
};

export const orderByAlunos = (o: Ordenacao<OrdemAlunos> = ORDEM_PADRAO_ALUNOS) => orderByDe(o, CRITERIOS_ALUNOS, POR_NOME);

export function whereFiltrosAlunos(f: FiltrosAlunos, escopoTurma?: Prisma.TurmaWhereInput): Prisma.AlunoWhereInput {
  const e: Prisma.AlunoWhereInput[] = [];
  for (const palavra of palavrasDaBusca(f.busca)) {
    const contem = { contains: palavra, mode: "insensitive" as const };
    e.push({ OR: [{ primeiroNome: contem }, { sobrenome: contem }, { nomePreferido: contem }, { codigo: contem }] });
  }
  if (f.status) e.push({ status: f.status });
  if (f.paisId) e.push({ paisId: f.paisId });
  if (f.turmaId) e.push({ alocacoes: { some: { ativa: true, turmaId: f.turmaId, ...(escopoTurma ? { turma: escopoTurma } : {}) } } });
  return e.length ? { AND: e } : {};
}

export function sanearFiltrosAlunos(
  f: FiltrosAlunos,
  opcoes: { paises: { id: string }[]; turmas: { id: string }[] },
): FiltrosAlunos {
  return {
    ...f,
    paisId: opcoes.paises.some((p) => p.id === f.paisId) ? f.paisId : null,
    turmaId: opcoes.turmas.some((t) => t.id === f.turmaId) ? f.turmaId : null,
  };
}

export const hrefAlunos = (f: FiltrosAlunos) => {
  const q = filtrosParaQuery(f);
  return q ? `/alunos?${q}` : "/alunos";
};

export function destinoPaginaAlunos(f: FiltrosAlunos, total: number): string | null {
  const ultima = Math.max(1, Math.ceil(total / ALUNOS_POR_PAGINA));
  return f.pagina > ultima ? hrefAlunos({ ...f, pagina: ultima }) : null;
}

export type CamposAlunos = { busca: string; status: string; pais: string; turma: string };
export const camposDosFiltros = (f: FiltrosAlunos): CamposAlunos =>
  ({ busca: f.busca, status: f.status ?? "", pais: f.paisId ?? "", turma: f.turmaId ?? "" });


export const hrefDosCampos = (c: CamposAlunos, ordem: Ordenacao<OrdemAlunos> = ORDEM_PADRAO_ALUNOS) =>
  hrefAlunos({ ...lerFiltrosAlunos({ busca: c.busca, status: c.status, pais: c.pais, turma: c.turma }), ordem });

export const parametrosFiltrosAlunos = (f: FiltrosAlunos) =>
  parametrosDaQuery(filtrosParaQuery({ ...f, ordem: ORDEM_PADRAO_ALUNOS }, { semPagina: true }));
