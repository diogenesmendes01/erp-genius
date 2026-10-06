import { StatusAluno, type Prisma } from "@prisma/client";
import { anexarOrdenacao, lerOrdenacao, orderByDe, parametrosDaQuery, type CriteriosOrdenacao, type Ordenacao } from "@/lib/ordenacao";

// Filtros da lista de alunos na URL (docs/42-auditoria-frontend-ux.md, E4): viviam em useState —
// abrir uma ficha e voltar perdia tudo, o link não era compartilhável e a planilha exportada
// ignorava o que a tela mostrava. Um único leitor serve a página e a rota de exportação, então a
// planilha sai com exatamente o mesmo recorte. Módulo puro: sem Prisma client, testável.

export const ALUNOS_POR_PAGINA = 50;

// Ordenação pelo cabeçalho (E1, §5.6 A9): lista fechada de colunas. Turma (várias por aluno) e
// situação financeira (calculada em memória a partir das cobranças) não têm ordem no banco e ficam fora.
export const ORDENS_ALUNOS = ["nome", "pais", "status"] as const;
export type OrdemAlunos = (typeof ORDENS_ALUNOS)[number];
/** A ordem de sempre da lista: nome crescente. */
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
    ordem: lerOrdenacao(p, ORDENS_ALUNOS, ORDEM_PADRAO_ALUNOS),
  };
}

/** Query string dos filtros (sem os vazios, sem a página 1 e sem a ordem padrão). `semPagina` para links de filtro e exportação. */
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

/** Palavras da busca (no máximo 6 — limita o tamanho da consulta). */
export const palavrasDaBusca = (busca: string) => busca.split(/\s+/).filter(Boolean).slice(0, 6);

/** Há filtro aplicado? A ordem não é filtro: não muda quais alunos aparecem. */
export const temFiltroAlunos = (f: FiltrosAlunos) => !!(f.busca || f.status || f.paisId || f.turmaId);

// Critérios de cada coluna. Nome: primeiro nome e sobrenome na mesma direção (a decrescente é o
// inverso exato da crescente). Nas outras colunas, empates por nome. Sempre com desempate final por id.
const POR_NOME: Prisma.AlunoOrderByWithRelationInput[] = [{ primeiroNome: "asc" }, { sobrenome: "asc" }, { id: "asc" }];
const CRITERIOS_ALUNOS: CriteriosOrdenacao<OrdemAlunos, Prisma.AlunoOrderByWithRelationInput> = {
  nome: (dir) => [{ primeiroNome: dir }, { sobrenome: dir }, { id: dir }],
  pais: (dir) => [{ pais: { nome: dir } }, ...POR_NOME],
  // Enum no banco: ordem de declaração (Ativo → Pausado → Encerrado), o ciclo de vida do aluno.
  status: (dir) => [{ status: dir }, ...POR_NOME],
};

/** `orderBy` da lista (tela e exportação): a coluna pedida, com desempate estável por id. Sem ordem: nome crescente. */
export const orderByAlunos = (o: Ordenacao<OrdemAlunos> = ORDEM_PADRAO_ALUNOS) => orderByDe(o, CRITERIOS_ALUNOS, POR_NOME);

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
 * Link a partir dos campos do formulário — mesmo leitor/validação da página; volta à página 1. A ordem
 * atual da lista (não é campo do formulário) é mantida: buscar não desfaz a ordenação escolhida.
 */
export const hrefDosCampos = (c: CamposAlunos, ordem: Ordenacao<OrdemAlunos> = ORDEM_PADRAO_ALUNOS) =>
  hrefAlunos({ ...lerFiltrosAlunos({ busca: c.busca, status: c.status, pais: c.pais, turma: c.turma }), ordem });

/** Busca e filtros atuais (sem página e sem ordem), para os links dos cabeçalhos ordenáveis. */
export const parametrosFiltrosAlunos = (f: FiltrosAlunos) =>
  parametrosDaQuery(filtrosParaQuery({ ...f, ordem: ORDEM_PADRAO_ALUNOS }, { semPagina: true }));
