import type { Prisma } from "@prisma/client";
import { lerOrdenacao, orderByDe, parametrosOrdenacao, type CriteriosOrdenacao, type Ordenacao } from "@/lib/ordenacao";
import type { ParametrosUrl } from "@/lib/pagina-url";

export const ORDENS_COMISSOES = ["vendedor", "valor", "status"] as const;
export type OrdemComissoes = (typeof ORDENS_COMISSOES)[number];
export const ORDEM_PADRAO_COMISSOES: Ordenacao<OrdemComissoes> = { campo: "vendedor", dir: "asc" };

const CRITERIOS_COMISSOES: CriteriosOrdenacao<OrdemComissoes, Prisma.ComissaoOrderByWithRelationInput> = {
  vendedor: (dir) => [{ vendedor: { nome: dir } }, { criadoEm: "desc" }, { id: "desc" }],
  valor: (dir) => [{ moeda: "asc" }, { valor: dir }, { id: dir }],
  status: (dir) => [{ status: dir }, { vendedor: { nome: "asc" } }, { criadoEm: "desc" }, { id: "desc" }],
};

const PADRAO = CRITERIOS_COMISSOES[ORDEM_PADRAO_COMISSOES.campo](ORDEM_PADRAO_COMISSOES.dir);

export const lerOrdemComissoes = (p: ParametrosUrl) => lerOrdenacao(p, ORDENS_COMISSOES, ORDEM_PADRAO_COMISSOES);

export const orderByComissoes = (o: Ordenacao<OrdemComissoes> = ORDEM_PADRAO_COMISSOES) => orderByDe(o, CRITERIOS_COMISSOES, PADRAO);

export const parametrosOrdemComissoes = (o: Ordenacao<OrdemComissoes>) => parametrosOrdenacao(o, ORDEM_PADRAO_COMISSOES);
