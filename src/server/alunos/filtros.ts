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

/** Palavras da busca (no máximo 6 — limita o tamanho da consulta). */
export const palavrasDaBusca = (busca: string) => busca.split(/\s+/).filter(Boolean).slice(0, 6);

export const temFiltroAlunos =(f: FiltrosAlunos) => !!(f.busca || f.status || f.paisId || f.turmaId);

/**
 * Condição dos filtros — sempre combinada com o escopo do usuário por quem consulta (AND), nunca no
 * lugar dele. `escopoTurma` restringe o filtro de turma às turmas que o usuário enxerga (professor):
 * sem isso, uma URL montada à mão revelaria que um aluno visível também está numa turma alheia.
 */
export function whereFiltrosAlunos(f: FiltrosAlunos, escopoTurma?: Prisma.TurmaWhereInput): Prisma.AlunoWhereInput {
  const e: Prisma.AlunoWhereInput[] = [];
  // Busca por palavras: cada uma precisa aparecer em algum campo. "Ana Silva" acha a aluna mesmo com
  // nome e sobrenome em colunas separadas (comparar a frase inteira em cada coluna não acharia).
  for (const palavra of palavrasDaBusca(f.busca)) {
    const contem = { contains: palavra, mode: "insensitive" as const };
    e.push({ OR: [{ primeiroNome: contem }, { sobrenome: contem }, { nomePreferido: contem }, { codigo: contem }] });
  }
  if (f.status) e.push({ status: f.status });
  if (f.paisId) e.push({ paisId: f.paisId });
  if (f.turmaId) e.push({ alocacoes: { some: { ativa: true, turmaId: f.turmaId, ...(escopoTurma ? { turma: escopoTurma } : {}) } } });
  return e.length ? { AND: e } : {};
}

/**
 * País/turma que não estão mais nas opções (link salvo, turma encerrada, fora do escopo) são
 * descartados — senão o select mostraria "Todas" e a lista viria filtrada e vazia.
 */
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

/** Link da lista com estes filtros ("/alunos" quando não há nenhum). */
export const hrefAlunos = (f: FiltrosAlunos) => {
  const q = filtrosParaQuery(f);
  return q ? `/alunos?${q}` : "/alunos";
};

/** Página além do fim (link antigo, filtro que encolheu): destino da última página que existe; null se a página é válida. */
export function destinoPaginaAlunos(f: FiltrosAlunos, total: number): string | null {
  const ultima = Math.max(1, Math.ceil(total / ALUNOS_POR_PAGINA));
  return f.pagina > ultima ? hrefAlunos({ ...f, pagina: ultima }) : null;
}

/** Valores dos campos do formulário (texto), a partir dos filtros. */
export type CamposAlunos = { busca: string; status: string; pais: string; turma: string };
export const camposDosFiltros = (f: FiltrosAlunos): CamposAlunos =>
  ({ busca: f.busca, status: f.status ?? "", pais: f.paisId ?? "", turma: f.turmaId ?? "" });

/**
 * Quando a URL muda (Limpar, voltar do navegador, link, resultado de um select), só os campos
 * cujo FILTRO mudou são atualizados; os demais mantêm o que a pessoa está digitando. Assim o
 * formulário não é recriado (o foco não se perde) e um select que navega não apaga a busca em edição.
 */
export function sincronizarCampos(atuais: CamposAlunos, anteriores: FiltrosAlunos, novos: FiltrosAlunos): CamposAlunos {
  const antes = camposDosFiltros(anteriores), depois = camposDosFiltros(novos);
  const r = { ...atuais };
  for (const k of Object.keys(depois) as (keyof CamposAlunos)[]) if (antes[k] !== depois[k]) r[k] = depois[k];
  return r;
}

/** Link a partir dos campos do formulário — mesmo leitor/validação da página; volta à página 1. */
export const hrefDosCampos = (c: CamposAlunos) => hrefAlunos(lerFiltrosAlunos({ busca: c.busca, status: c.status, pais: c.pais, turma: c.turma }));
