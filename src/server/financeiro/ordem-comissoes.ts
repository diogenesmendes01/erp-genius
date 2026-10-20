import type { Prisma } from "@prisma/client";
import { lerOrdenacao, orderByDe, parametrosOrdenacao, type CriteriosOrdenacao, type Ordenacao } from "@/lib/ordenacao";
import type { ParametrosUrl } from "@/lib/pagina-url";

// Ordenação das listas de comissões (/financeiro/comissoes e a aba do /financeiro) pelo cabeçalho (E1,
// docs/42-auditoria-frontend-ux.md §5.6 A9, que chamava a lista de "/comissoes"; não é o painel do CRM em
// /comissoes). Lista fechada de colunas,
// ordem feita no banco antes da página. Módulo puro (sem Prisma client): as páginas leem a URL daqui.

export const ORDENS_COMISSOES = ["vendedor", "valor", "status"] as const;
export type OrdemComissoes = (typeof ORDENS_COMISSOES)[number];
/** A ordem de sempre: beneficiário crescente (e, dentro dele, a mais recente primeiro). */
export const ORDEM_PADRAO_COMISSOES: Ordenacao<OrdemComissoes> = { campo: "vendedor", dir: "asc" };

const CRITERIOS_COMISSOES: CriteriosOrdenacao<OrdemComissoes, Prisma.ComissaoOrderByWithRelationInput> = {
  vendedor: (dir) => [{ vendedor: { nome: dir } }, { criadoEm: "desc" }, { id: "desc" }],
  // Valores em moedas diferentes não se comparam (100 USD × 50 000 CRC): agrupa por moeda e ordena o
  // valor dentro de cada uma.
  valor: (dir) => [{ moeda: "asc" }, { valor: dir }, { id: dir }],
  // Enum no banco: ordem de declaração (Pendente → Aprovada → Paga → Estornada), o ciclo da comissão.
  status: (dir) => [{ status: dir }, { vendedor: { nome: "asc" } }, { criadoEm: "desc" }, { id: "desc" }],
};

/** Reserva do orderByDe (sem coluna válida): o critério da própria coluna padrão, não uma lista à parte (C50, #170). */
const PADRAO = CRITERIOS_COMISSOES[ORDEM_PADRAO_COMISSOES.campo](ORDEM_PADRAO_COMISSOES.dir);

/** Ordem da URL (`ordem`/`dir`); fora da lista fechada → a padrão. */
export const lerOrdemComissoes = (p: ParametrosUrl) => lerOrdenacao(p, ORDENS_COMISSOES, ORDEM_PADRAO_COMISSOES);

/** `orderBy` da consulta, com desempate estável por id. */
export const orderByComissoes = (o: Ordenacao<OrdemComissoes> = ORDEM_PADRAO_COMISSOES) => orderByDe(o, CRITERIOS_COMISSOES, PADRAO);

/** `ordem`/`dir` para os links da lista (paginação, filtro, redirecionamento) — vazios na ordem padrão. */
export const parametrosOrdemComissoes = (o: Ordenacao<OrdemComissoes>) => parametrosOrdenacao(o, ORDEM_PADRAO_COMISSOES);
