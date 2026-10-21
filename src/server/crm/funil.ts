import { EtapaLead, OrigemCanal, Prisma, Temperatura, type CorTag } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { palavrasDaBuscaLeads } from "@/server/comercial/filtros";
import { TIPOS_MUDAM_ETAPA } from "@/server/comercial/schema";
import { COLUNAS_FUNIL } from "./etapas";
import { whereOportunidadeEmSql } from "./oportunidade-sql";

export type FiltrosFunil = {
  busca: string;
  tipo: "" | "pf" | "b2b";
  donoId: string;
  temperatura: Temperatura | "";
  origem: OrigemCanal | "";
  tagId: string;
  perdidosDias: "30" | "90" | "todos";
  ordem: "recentes" | "valor" | "proxima" | "tempo";
};

export type CartaoFunil = {
  id: string;
  codigo: string | null;
  nome: string;
  b2b: boolean;
  etapa: EtapaLead;
  temperatura: Temperatura;
  valorPrevisto: string | null;
  moeda: string | null;
  pais: string | null;
  dono: { id: string; nome: string } | null;
  proximaAcao: string | null;
  proximoFollowUp: Date | null;
  dataExperimental: Date | null;
  etapaDesde: Date;
  ultimaAcaoEm: Date;
  tags: { id: string; nome: string; cor: CorTag }[];
  pessoaId: string | null;
};

export type ColunaFunil = {
  etapa: EtapaLead;
  total: number;
  somaPorMoeda: { moeda: string; valor: string }[];
  cartoes: CartaoFunil[];
  possuiMais: boolean;
};

export const CARTOES_POR_COLUNA = 50;

const INCLUIR_CARTAO = {
  pais: { select: { nome: true, moedaLocal: true } },
  vendedor: { select: { id: true, nome: true } },
  pessoa: { select: { tags: { select: { tag: { select: { id: true, nome: true, cor: true } } } } } },
} satisfies Prisma.OportunidadeInclude;

type Params = Record<string, string | string[] | undefined>;

function um(p: Params, chave: string): string {
  const v = p[chave];
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" ? s.trim() : "";
}

const noEnum = <T extends string>(valor: string, enumObj: Record<string, T>): T | "" =>
  (Object.values(enumObj) as string[]).includes(valor) ? (valor as T) : "";

export function lerFiltrosFunil(p: Params): FiltrosFunil {
  const tipo = um(p, "tipo");
  const perdidos = um(p, "perdidosDias");
  const ordem = um(p, "ordem");
  return {
    busca: um(p, "busca").slice(0, 200),
    tipo: tipo === "pf" || tipo === "b2b" ? tipo : "",
    donoId: um(p, "donoId"),
    temperatura: noEnum(um(p, "temperatura"), Temperatura),
    origem: noEnum(um(p, "origem"), OrigemCanal),
    tagId: um(p, "tagId"),
    perdidosDias: perdidos === "30" || perdidos === "90" ? perdidos : "todos",
    ordem: ordem === "valor" || ordem === "proxima" || ordem === "tempo" ? ordem : "recentes",
  };
}

function whereDosFiltros(f: FiltrosFunil): Prisma.OportunidadeWhereInput {
  const palavras = palavrasDaBuscaLeads(f.busca);
  return {
    ...(f.tipo ? { b2b: f.tipo === "b2b" } : {}),
    ...(f.donoId ? { vendedorDonoId: f.donoId } : {}),
    ...(f.temperatura ? { temperatura: f.temperatura } : {}),
    ...(f.origem ? { origemCanal: f.origem } : {}),
    ...(f.tagId ? { pessoa: { is: { tags: { some: { tagId: f.tagId } } } } } : {}),
    ...(palavras.length
      ? {
          AND: palavras.map((palavra) => {
            const contem = { contains: palavra, mode: "insensitive" as const };
            return { OR: [{ nome: contem }, { codigo: contem }] };
          }),
        }
      : {}),
  };
}

// Ordem de cada coluna. "tempo" (desde quando está na etapa, que vem de Evento) e o período dos perdidos (última
// ação, também de Evento) não cabem no `orderBy`/`where` do Prisma: essas colunas vão por `colunaPorSql`, que
// ordena e corta no banco com a MESMA ordem (B19, #196 C3).
function ordenacao(ordem: Exclude<FiltrosFunil["ordem"], "tempo">): Prisma.OportunidadeOrderByWithRelationInput[] {
  switch (ordem) {
    case "valor":
      return [{ valorPrevisto: { sort: "desc", nulls: "last" } }, { id: "desc" }];
    case "proxima":
      return [{ proximoFollowUp: { sort: "asc", nulls: "last" } }, { id: "desc" }];
    default:
      return [{ criadoEm: "desc" }, { id: "desc" }];
  }
}

/**
 * Junção lateral com o último Evento do Lead (alias `o`), de qualquer tipo ou só dos `tipos` dados, exposto como
 * `<apelido>."em"`. Lateral, e não subconsulta no WHERE/ORDER BY: o planejador estima o custo pelas linhas que
 * passaram nos filtros baratos (escopo, etapa) e não pela tabela inteira, o que evita compilar JIT à toa.
 */
const ultimoEventoSql = (apelido: "ua" | "ue", tipos?: readonly string[]) => Prisma.sql`
  LEFT JOIN LATERAL (
    SELECT MAX(e."criadoEm") AS "em" FROM "Evento" e
    WHERE e."agregadoTipo" = 'Lead' AND e."agregadoId" = o."id"${tipos ? Prisma.sql` AND e."tipo" IN (${Prisma.join([...tipos])})` : Prisma.empty}
  ) ${Prisma.raw(apelido)} ON TRUE`;

/**
 * O mesmo `ordenacao` em SQL. Em "tempo", a data é a da última mudança de etapa (`ue`, ou a criação), a mais antiga
 * primeiro, com desempate pelo id em ordem binária (`COLLATE "C"`, a do `<` do JS da versão em memória). Nas outras,
 * o desempate pelo id usa a collation da coluna, como o `orderBy` do Prisma.
 */
function ordenacaoSql(ordem: FiltrosFunil["ordem"]): Prisma.Sql {
  switch (ordem) {
    case "valor":
      return Prisma.sql`o."valorPrevisto" DESC NULLS LAST, o."id" DESC`;
    case "proxima":
      return Prisma.sql`o."proximoFollowUp" ASC NULLS LAST, o."id" DESC`;
    case "tempo":
      return Prisma.sql`COALESCE(ue."em", o."criadoEm") ASC, o."id" COLLATE "C" ASC`;
    default:
      return Prisma.sql`o."criadoEm" DESC, o."id" DESC`;
  }
}

type GrupoPais = { paisId: string | null; _count: { _all: number }; _sum: { valorPrevisto: Prisma.Decimal | null } };

/**
 * Totais por país e ids da página de uma coluna, filtrados, ordenados e cortados no banco. `corte`: só entram as
 * que tiveram a última ação (Evento de qualquer tipo, ou a criação) a partir dele (período dos perdidos).
 */
async function colunaPorSql(
  condicao: Prisma.Sql,
  ordem: FiltrosFunil["ordem"],
  corte: Date | null,
): Promise<{ grupos: GrupoPais[]; ids: string[] }> {
  const periodo = corte
    ? { juncao: ultimoEventoSql("ua"), filtro: Prisma.sql` AND COALESCE(ua."em", o."criadoEm") >= (CAST(${corte.toISOString()} AS timestamptz) AT TIME ZONE 'UTC')` }
    : { juncao: Prisma.empty, filtro: Prisma.empty };
  const juncaoOrdem = ordem === "tempo" ? ultimoEventoSql("ue", TIPOS_MUDAM_ETAPA) : Prisma.empty;
  const [grupos, ids] = await Promise.all([
    prisma.$queryRaw<{ paisId: string | null; total: number; soma: Prisma.Decimal | null }[]>`
      SELECT o."paisId" AS "paisId", COUNT(*)::int AS "total", SUM(o."valorPrevisto") AS "soma"
      FROM "Lead" o ${periodo.juncao}
      WHERE ${condicao}${periodo.filtro}
      GROUP BY o."paisId"`,
    prisma.$queryRaw<{ id: string }[]>`
      SELECT o."id" FROM "Lead" o ${periodo.juncao} ${juncaoOrdem}
      WHERE ${condicao}${periodo.filtro}
      ORDER BY ${ordenacaoSql(ordem)}
      LIMIT ${CARTOES_POR_COLUNA}`,
  ]);
  return {
    grupos: grupos.map((g) => ({ paisId: g.paisId, _count: { _all: g.total }, _sum: { valorPrevisto: g.soma } })),
    ids: ids.map((i) => i.id),
  };
}

const ordemMoeda = (m: string) => (m === "USD" ? 0 : 1);

export async function carregarFunil(usuario: UsuarioSessao, f: FiltrosFunil): Promise<ColunaFunil[]> {
  const base: Prisma.OportunidadeWhereInput = { AND: [await escopoComercialAtual(usuario), whereDosFiltros(f)] };
  // Perdidos: o período vale pela última ação (Evento de qualquer tipo), não pela criação.
  const corte = f.perdidosDias !== "todos" ? new Date(Date.now() - Number(f.perdidosDias) * 86_400_000) : null;
  let baseSql: Prisma.Sql | null = null;

  return Promise.all(
    COLUNAS_FUNIL.map(async (etapa): Promise<ColunaFunil> => {
      const where: Prisma.OportunidadeWhereInput = { AND: [base, { etapa }] };
      const comPeriodo = etapa === EtapaLead.PERDIDO && corte !== null;
      let grupos: GrupoPais[];
      let linhas: Prisma.OportunidadeGetPayload<{ include: typeof INCLUIR_CARTAO }>[];
      if (f.ordem === "tempo" || comPeriodo) {
        baseSql ??= whereOportunidadeEmSql(base);
        const coluna = await colunaPorSql(Prisma.sql`${baseSql} AND o."etapa" = CAST(${etapa} AS "EtapaLead")`, f.ordem, comPeriodo ? corte : null);
        grupos = coluna.grupos;
        const posicao = new Map(coluna.ids.map((id, i) => [id, i]));
        linhas = coluna.ids.length
          ? (await prisma.oportunidade.findMany({ where: { AND: [where, { id: { in: coluna.ids } }] }, include: INCLUIR_CARTAO }))
              .sort((a, b) => posicao.get(a.id)! - posicao.get(b.id)!)
          : [];
      } else {
        [grupos, linhas] = await Promise.all([
          prisma.oportunidade.groupBy({ by: ["paisId"], where, _count: { _all: true }, _sum: { valorPrevisto: true } }),
          prisma.oportunidade.findMany({ where, orderBy: ordenacao(f.ordem), take: CARTOES_POR_COLUNA, include: INCLUIR_CARTAO }),
        ]);
      }
      const total = grupos.reduce((s, g) => s + g._count._all, 0);
      const paisesIds = grupos.map((g) => g.paisId).filter((x): x is string => !!x);
      const paises = paisesIds.length
        ? await prisma.pais.findMany({ where: { id: { in: paisesIds } }, select: { id: true, moedaLocal: true } })
        : [];
      const moedaDoPais = new Map(paises.map((p) => [p.id, p.moedaLocal]));
      const somas = new Map<string, Prisma.Decimal>();
      for (const g of grupos) {
        const moeda = g.paisId ? moedaDoPais.get(g.paisId) : undefined;
        if (!moeda || !g._sum.valorPrevisto) continue;
        somas.set(moeda, (somas.get(moeda) ?? new Prisma.Decimal(0)).plus(g._sum.valorPrevisto));
      }
      const somaPorMoeda = [...somas.entries()]
        .map(([moeda, valor]) => ({ moeda, valor: valor.toFixed(2) }))
        .sort((a, b) => ordemMoeda(a.moeda) - ordemMoeda(b.moeda) || a.moeda.localeCompare(b.moeda));

      const ids = linhas.map((l) => l.id);
      const [ultimas, mudancas] = ids.length
        ? await Promise.all([
            prisma.evento.groupBy({
              by: ["agregadoId"],
              where: { agregadoTipo: "Lead", agregadoId: { in: ids } },
              _max: { criadoEm: true },
            }),
            prisma.evento.groupBy({
              by: ["agregadoId"],
              where: { agregadoTipo: "Lead", tipo: { in: TIPOS_MUDAM_ETAPA }, agregadoId: { in: ids } },
              _max: { criadoEm: true },
            }),
          ])
        : [[], []];
      const mapUltima = new Map(ultimas.map((u) => [u.agregadoId, u._max.criadoEm]));
      const mapEtapa = new Map(mudancas.map((u) => [u.agregadoId, u._max.criadoEm]));

      const cartoes: CartaoFunil[] = linhas.map((l) => ({
        id: l.id,
        codigo: l.codigo,
        nome: l.nome,
        b2b: l.b2b,
        etapa: l.etapa,
        temperatura: l.temperatura,
        valorPrevisto: l.valorPrevisto ? l.valorPrevisto.toFixed(2) : null,
        moeda: l.pais?.moedaLocal ?? null,
        pais: l.pais?.nome ?? null,
        dono: l.vendedor ? { id: l.vendedor.id, nome: l.vendedor.nome } : null,
        proximaAcao: l.proximaAcao,
        proximoFollowUp: l.proximoFollowUp,
        dataExperimental: l.dataExperimental,
        etapaDesde: mapEtapa.get(l.id) ?? l.criadoEm,
        ultimaAcaoEm: mapUltima.get(l.id) ?? l.criadoEm,
        tags: (l.pessoa?.tags ?? []).map((t) => t.tag).sort((a, b) => a.nome.localeCompare(b.nome)),
        pessoaId: l.pessoaId,
      }));

      return { etapa, total, somaPorMoeda, cartoes, possuiMais: total > cartoes.length };
    }),
  );
}
