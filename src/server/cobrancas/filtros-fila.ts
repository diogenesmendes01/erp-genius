import type { FilaCobrancaItem } from "./consultas";

// Filtros da fila de cobrança na URL (docs/42-auditoria-frontend-ux.md, E4): o cartão-indicador, a
// busca, o país e a turma viviam em useState — F5, voltar do navegador, nova aba e link compartilhado
// perdiam o recorte. Mesmo desenho das listas de alunos, leads e empresas: um leitor único valida a
// URL no servidor, que já entrega a fila filtrada e ordenada. A fila não é paginada (a régua é
// calculada em memória para cada cobrança aberta). Módulo puro: sem Prisma client, testável.

export const ROTA_FILA = "/financeiro/cobrancas";

/** Cartões-indicadores que filtram a fila (lista fechada; as mesmas chaves dos contadores). */
export const INDICADORES_FILA = ["aVencer", "emAtraso", "bloquear", "promessas"] as const;
export type IndicadorFila = (typeof INDICADORES_FILA)[number];

export type FiltrosFila = {
  indicador: IndicadorFila | null;
  busca: string;
  /** Nome do país, como a fila o exibe. */
  pais: string | null;
  /** Rótulo da turma ("Modalidade Nível"), como a fila o exibe. */
  turma: string | null;
};

type Parametros = Record<string, string | string[] | undefined> | URLSearchParams;

function valor(p: Parametros, chave: string): string {
  const v = p instanceof URLSearchParams ? p.get(chave) : p[chave];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

/** Lê e valida: indicador só da lista fechada; busca, país e turma até 100 caracteres. Resto é ignorado. */
export function lerFiltrosFila(p: Parametros): FiltrosFila {
  const indicador = valor(p, "indicador");
  return {
    indicador: (INDICADORES_FILA as readonly string[]).includes(indicador) ? (indicador as IndicadorFila) : null,
    busca: valor(p, "busca").slice(0, 100),
    pais: valor(p, "pais").slice(0, 100) || null,
    turma: valor(p, "turma").slice(0, 100) || null,
  };
}

/** Query string dos filtros (sem os vazios). */
export function filtrosFilaParaQuery(f: FiltrosFila): string {
  const q = new URLSearchParams();
  if (f.indicador) q.set("indicador", f.indicador);
  if (f.busca) q.set("busca", f.busca);
  if (f.pais) q.set("pais", f.pais);
  if (f.turma) q.set("turma", f.turma);
  return q.toString();
}

/** Link da fila com estes filtros (a rota da aba quando não há nenhum). */
export const hrefFila = (f: FiltrosFila) => {
  const q = filtrosFilaParaQuery(f);
  return q ? `${ROTA_FILA}?${q}` : ROTA_FILA;
};

/** Há busca, país ou turma (os campos do formulário)? O indicador é à parte: tem o próprio "limpar". */
export const temBuscaFila = (f: FiltrosFila) => !!(f.busca || f.pais || f.turma);

/** Link do cartão-indicador: alterna (clicar no ativo desliga) e mantém a busca, o país e a turma. */
export const hrefIndicador = (f: FiltrosFila, indicador: IndicadorFila) =>
  hrefFila({ ...f, indicador: f.indicador === indicador ? null : indicador });

/** Link sem o indicador, mantendo a busca. */
export const hrefSemIndicador = (f: FiltrosFila) => hrefFila({ ...f, indicador: null });

/** Link sem busca, país e turma, mantendo o indicador escolhido. */
export const hrefSemBusca = (f: FiltrosFila) => hrefFila({ ...lerFiltrosFila({}), indicador: f.indicador });

/** Valores dos campos do formulário (texto), a partir dos filtros. */
export type CamposFila = { busca: string; pais: string; turma: string };
export const camposDosFiltrosFila = (f: FiltrosFila): CamposFila => ({ busca: f.busca, pais: f.pais ?? "", turma: f.turma ?? "" });

/**
 * Link a partir dos campos do formulário — mesmo leitor/validação da página. O indicador escolhido
 * (não é campo do formulário) é mantido: buscar não desliga o cartão.
 */
export const hrefDosCamposFila = (c: CamposFila, indicador: IndicadorFila | null = null) =>
  hrefFila({ ...lerFiltrosFila({ busca: c.busca, pais: c.pais, turma: c.turma }), indicador });

/** Palavras da busca (no máximo 6 — limita o trabalho por cobrança, como nas outras listas). */
export const palavrasDaBuscaFila = (busca: string) => busca.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);

type ItemIndicador = Pick<FilaCobrancaItem, "estado" | "diasAtraso" | "precisaBloqueio">;
type ItemFiltravel = ItemIndicador & Pick<FilaCobrancaItem, "codigo" | "pais" | "turma" | "prioridade"> & {
  aluno: { nome: string };
};

// Critério de cada indicador — fonte única do número do cartão (contarIndicadoresFila, usado por
// listarFilaCobranca) e da lista filtrada (filtrarFila), para os dois não divergirem: "Bloquear" ⊂ "Em atraso";
// promessa fica fora de "A vencer" e "Em atraso"; a cobrança que vence hoje (diasAtraso 0) é "A vencer".
const DO_INDICADOR: Record<IndicadorFila, (i: ItemIndicador) => boolean> = {
  aVencer: (i) => i.estado !== "promessa" && i.diasAtraso <= 0,
  emAtraso: (i) => i.estado !== "promessa" && i.diasAtraso > 0,
  bloquear: (i) => i.precisaBloqueio,
  promessas: (i) => i.estado === "promessa",
};

/** Números dos cartões-indicadores (mini-dashs) sobre a fila inteira, com o mesmo critério do filtro. */
export function contarIndicadoresFila(itens: ItemIndicador[]): Record<IndicadorFila, number> {
  const conta = (indicador: IndicadorFila) => itens.filter(DO_INDICADOR[indicador]).length;
  return { aVencer: conta("aVencer"), emAtraso: conta("emAtraso"), bloquear: conta("bloquear"), promessas: conta("promessas") };
}

/**
 * A fila exibida: indicador, busca por palavras (cada uma no nome do aluno ou no código da cobrança),
 * país e turma; ordenada por prioridade da régua e, no empate, pelo maior atraso.
 */
export function filtrarFila<T extends ItemFiltravel>(itens: T[], f: FiltrosFila): T[] {
  const palavras = palavrasDaBuscaFila(f.busca);
  return itens
    .filter((i) => !f.indicador || DO_INDICADOR[f.indicador](i))
    .filter((i) => palavras.every((p) => i.aluno.nome.toLowerCase().includes(p) || (i.codigo ?? "").toLowerCase().includes(p)))
    .filter((i) => !f.pais || i.pais === f.pais)
    .filter((i) => !f.turma || i.turma === f.turma)
    .sort((a, b) => a.prioridade - b.prioridade || b.diasAtraso - a.diasAtraso);
}

/**
 * Opções dos selects, a partir da fila inteira (não da filtrada). O país/turma da URL que não está mais
 * na fila (a última cobrança daquele país foi paga, link antigo) continua como opção: o select mostra o
 * que está filtrado e a lista vem vazia com a saída "Limpar filtros" — em vez de fingir "Todos".
 */
export function opcoesDaFila(itens: Pick<FilaCobrancaItem, "pais" | "turma">[], f: FiltrosFila): { paises: string[]; turmas: string[] } {
  const unicos = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();
  return { paises: unicos([...itens.map((i) => i.pais), f.pais]), turmas: unicos([...itens.map((i) => i.turma), f.turma]) };
}
