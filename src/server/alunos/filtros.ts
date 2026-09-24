import { StatusAluno, type Prisma } from "@prisma/client";

// Filtros da lista de alunos na URL (docs/42-auditoria-frontend-ux.md, E4): viviam em useState —
// abrir uma ficha e voltar perdia tudo, o link não era compartilhável e a planilha exportada
// ignorava o que a tela mostrava. Um único leitor serve a página e a rota de exportação, então a
// planilha sai com exatamente o mesmo recorte. Módulo puro: sem Prisma client, testável.

export const ALUNOS_POR_PAGINA = 50;

export type FiltrosAlunos = {
  busca: string;
  status: StatusAluno | null;
  paisId: string | null;
  turmaId: string | null;
  pagina: number;
};

type Parametros = Record<string, string | string[] | undefined> | URLSearchParams;

function valor(p: Parametros, chave: string): string {
  const v = p instanceof URLSearchParams ? p.get(chave) : p[chave];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

/** Lê e valida: busca até 100 caracteres; status só do enum; ids curtos; página inteira 1..100000. Resto é ignorado. */
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
  };
}

/** Query string dos filtros (sem os vazios e sem a página 1). `semPagina` para links de filtro e exportação. */
export function filtrosParaQuery(f: FiltrosAlunos, { semPagina = false } = {}): string {
  const q = new URLSearchParams();
  if (f.busca) q.set("busca", f.busca);
  if (f.status) q.set("status", f.status);
  if (f.paisId) q.set("pais", f.paisId);
  if (f.turmaId) q.set("turma", f.turmaId);
  if (!semPagina && f.pagina > 1) q.set("pagina", String(f.pagina));
  return q.toString();
}

export const temFiltroAlunos = (f: FiltrosAlunos) => !!(f.busca || f.status || f.paisId || f.turmaId);

/**
 * Condição dos filtros — sempre combinada com o escopo do usuário por quem consulta (AND), nunca no
 * lugar dele. `escopoTurma` restringe o filtro de turma às turmas que o usuário enxerga (professor):
 * sem isso, uma URL montada à mão revelaria que um aluno visível também está numa turma alheia.
 */
export function whereFiltrosAlunos(f: FiltrosAlunos, escopoTurma?: Prisma.TurmaWhereInput): Prisma.AlunoWhereInput {
  const e: Prisma.AlunoWhereInput[] = [];
  if (f.busca) {
    const contem = { contains: f.busca, mode: "insensitive" as const };
    e.push({ OR: [{ primeiroNome: contem }, { sobrenome: contem }, { nomePreferido: contem }, { codigo: contem }] });
  }
  if (f.status) e.push({ status: f.status });
  if (f.paisId) e.push({ paisId: f.paisId });
  if (f.turmaId) e.push({ alocacoes: { some: { ativa: true, turmaId: f.turmaId, ...(escopoTurma ? { turma: escopoTurma } : {}) } } });
  return e.length ? { AND: e } : {};
}
