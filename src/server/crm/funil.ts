import { EtapaLead, OrigemCanal, Prisma, Temperatura, type CorTag } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { palavrasDaBuscaLeads } from "@/server/comercial/filtros";
import { TIPOS_MUDAM_ETAPA } from "@/server/comercial/schema";
import { COLUNAS_FUNIL } from "./etapas";

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

// "tempo": a coluna não guarda desde quando a oportunidade está na etapa (isso vem de Evento);
// a ordenação usa a criação (mais antiga primeiro) como aproximação.
function ordenacao(ordem: FiltrosFunil["ordem"]): Prisma.OportunidadeOrderByWithRelationInput[] {
  switch (ordem) {
    case "valor":
      return [{ valorPrevisto: { sort: "desc", nulls: "last" } }, { id: "desc" }];
    case "proxima":
      return [{ proximoFollowUp: { sort: "asc", nulls: "last" } }, { id: "desc" }];
    case "tempo":
      return [{ criadoEm: "asc" }, { id: "asc" }];
    default:
      return [{ criadoEm: "desc" }, { id: "desc" }];
  }
}

const ordemMoeda = (m: string) => (m === "USD" ? 0 : 1);

export async function carregarFunil(usuario: UsuarioSessao, f: FiltrosFunil): Promise<ColunaFunil[]> {
  const base: Prisma.OportunidadeWhereInput = { AND: [await escopoComercialAtual(usuario), whereDosFiltros(f)] };

  // Perdidos: o período vale pela última ação (Evento), não pela criação.
  let wherePerdido: Prisma.OportunidadeWhereInput = { AND: [base, { etapa: EtapaLead.PERDIDO }] };
  if (f.perdidosDias !== "todos") {
    const corte = new Date(Date.now() - Number(f.perdidosDias) * 86_400_000);
    const perdidos = await prisma.oportunidade.findMany({ where: wherePerdido, select: { id: true, criadoEm: true } });
    const ultimas = perdidos.length
      ? await prisma.evento.groupBy({
          by: ["agregadoId"],
          where: { agregadoTipo: "Lead", agregadoId: { in: perdidos.map((p) => p.id) } },
          _max: { criadoEm: true },
        })
      : [];
    const mapa = new Map(ultimas.map((u) => [u.agregadoId, u._max.criadoEm]));
    const ids = perdidos.filter((p) => (mapa.get(p.id) ?? p.criadoEm) >= corte).map((p) => p.id);
    wherePerdido = { AND: [wherePerdido, { id: { in: ids } }] };
  }
  const whereDa = (etapa: EtapaLead): Prisma.OportunidadeWhereInput =>
    etapa === EtapaLead.PERDIDO ? wherePerdido : { AND: [base, { etapa }] };

  return Promise.all(
    COLUNAS_FUNIL.map(async (etapa): Promise<ColunaFunil> => {
      const where = whereDa(etapa);
      const [grupos, linhas] = await Promise.all([
        prisma.oportunidade.groupBy({
          by: ["paisId"],
          where,
          _count: { _all: true },
          _sum: { valorPrevisto: true },
        }),
        prisma.oportunidade.findMany({
          where,
          orderBy: ordenacao(f.ordem),
          take: CARTOES_POR_COLUNA,
          include: {
            pais: { select: { nome: true, moedaLocal: true } },
            vendedor: { select: { id: true, nome: true } },
            pessoa: { select: { tags: { select: { tag: { select: { id: true, nome: true, cor: true } } } } } },
          },
        }),
      ]);

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
