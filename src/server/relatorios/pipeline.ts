import { Prisma, type Temperatura } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EscopoRelatorio } from "./escopo";
import type { Periodo } from "./periodo";

/** Filtros comuns dos relatórios do CRM. `autor` separa o que a Aria executou do que a equipe fez. */
export interface FiltrosRelatorio {
  periodo: Periodo;
  responsavelId?: string;
  origem?: string;
  temperatura?: Temperatura;
  autor?: "ARIA" | "EQUIPE";
}

/** Instante UTC comparável com colunas `timestamp(3)` (que guardam UTC sem fuso). */
export const instanteUtc = (d: Date) => Prisma.sql`${d}::timestamptz AT TIME ZONE 'UTC'`;

/**
 * Condição SQL sobre `"Lead" l` com escopo do papel + filtros. Valores sempre parametrizados.
 * `autor = ARIA`: a Aria executou (ou teve aprovada) ao menos uma ação na oportunidade.
 */
export function condicoesLead(f: FiltrosRelatorio, e: EscopoRelatorio): Prisma.Sql {
  const partes: Prisma.Sql[] = [];
  if (e.tipo === "USUARIOS") {
    partes.push(e.ids.length ? Prisma.sql`l."vendedorDonoId" IN (${Prisma.join(e.ids)})` : Prisma.sql`FALSE`);
  }
  if (f.responsavelId) partes.push(Prisma.sql`l."vendedorDonoId" = ${f.responsavelId}`);
  if (f.origem) partes.push(Prisma.sql`l."origemCanal"::text = ${f.origem}`);
  if (f.temperatura) partes.push(Prisma.sql`l."temperatura"::text = ${f.temperatura}`);
  if (f.autor) {
    const existe = Prisma.sql`EXISTS (SELECT 1 FROM "AcaoAgenteIA" a WHERE a."oportunidadeId" = l.id AND a.status::text IN ('EXECUTADA', 'APROVADA'))`;
    partes.push(f.autor === "ARIA" ? existe : Prisma.sql`NOT ${existe}`);
  }
  return partes.length ? Prisma.join(partes, " AND ") : Prisma.sql`TRUE`;
}

export interface ValorPorMoeda {
  moeda: string;
  valor: number;
}

export interface MetricasPipeline {
  valorPipeline: ValorPorMoeda[];
  semValor: number;
  abertas: number;
  criadas: number;
  ganhas: number;
  conversao: number | null;
  ticketMedio: ValorPorMoeda[];
  cicloMedioDias: number | null;
}

const arred = (n: number, casas = 2) => Math.round(n * 10 ** casas) / 10 ** casas;

/**
 * Pipeline comercial. Valores nunca somam moedas diferentes (moeda = moeda local do país da oportunidade);
 * oportunidade aberta sem valor, ou sem país (moeda indeterminada), conta em `semValor`.
 * `criadas`: criadas no período. `ganhas`: entraram em MATRICULADO no período (evento de etapa).
 * `conversao`: das criadas no período, quantas estão hoje MATRICULADO (coorte, sempre entre 0 e 1); null sem criadas.
 * `ticketMedio`: valor previsto médio das ganhas, por moeda. `cicloMedioDias`: criação → matrícula das ganhas.
 */
export async function metricasPipeline(f: FiltrosRelatorio, e: EscopoRelatorio): Promise<MetricasPipeline> {
  const cond = condicoesLead(f, e);
  const ini = instanteUtc(f.periodo.inicio);
  const fim = instanteUtc(f.periodo.fim);

  const [totais] = await prisma.$queryRaw<{ abertas: bigint; sem_valor: bigint; criadas: bigint; criadas_ganhas: bigint }[]>(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE l.etapa::text NOT IN ('MATRICULADO', 'PERDIDO')) AS abertas,
      COUNT(*) FILTER (WHERE l.etapa::text NOT IN ('MATRICULADO', 'PERDIDO') AND (l."valorPrevisto" IS NULL OR p.id IS NULL)) AS sem_valor,
      COUNT(*) FILTER (WHERE l."criadoEm" >= ${ini} AND l."criadoEm" < ${fim}) AS criadas,
      COUNT(*) FILTER (WHERE l."criadoEm" >= ${ini} AND l."criadoEm" < ${fim} AND l.etapa::text = 'MATRICULADO') AS criadas_ganhas
    FROM "Lead" l LEFT JOIN "Pais" p ON p.id = l."paisId"
    WHERE ${cond}`);

  const pipeline = await prisma.$queryRaw<{ moeda: string; valor: number }[]>(Prisma.sql`
    SELECT p."moedaLocal" AS moeda, SUM(l."valorPrevisto")::float8 AS valor
    FROM "Lead" l JOIN "Pais" p ON p.id = l."paisId"
    WHERE ${cond} AND l.etapa::text NOT IN ('MATRICULADO', 'PERDIDO') AND l."valorPrevisto" IS NOT NULL
    GROUP BY p."moedaLocal" ORDER BY p."moedaLocal"`);

  // Ganhas: primeira entrada em MATRICULADO dentro do período, uma vez por oportunidade.
  const ganhas = await prisma.$queryRaw<{ moeda: string | null; valor: number | null; dias: number }[]>(Prisma.sql`
    SELECT p."moedaLocal" AS moeda, l."valorPrevisto"::float8 AS valor,
           EXTRACT(EPOCH FROM (g.em - l."criadoEm")) / 86400.0 AS dias
    FROM "Lead" l
    JOIN (
      SELECT ev."agregadoId" AS lid, MIN(ev."criadoEm") AS em
      FROM "Evento" ev
      WHERE ev."agregadoTipo" = 'Lead' AND ev.tipo = 'EtapaAlterada' AND ev.payload ->> 'para' = 'MATRICULADO'
      GROUP BY ev."agregadoId"
    ) g ON g.lid = l.id
    LEFT JOIN "Pais" p ON p.id = l."paisId"
    WHERE ${cond} AND g.em >= ${ini} AND g.em < ${fim}`);

  const porMoeda = new Map<string, { soma: number; n: number }>();
  for (const g of ganhas) {
    if (g.valor == null || g.moeda == null) continue;
    const acc = porMoeda.get(g.moeda) ?? { soma: 0, n: 0 };
    acc.soma += g.valor;
    acc.n += 1;
    porMoeda.set(g.moeda, acc);
  }
  const ticketMedio = [...porMoeda.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([moeda, { soma, n }]) => ({ moeda, valor: arred(soma / n) }));

  const criadas = Number(totais.criadas);
  return {
    valorPipeline: pipeline.map((x) => ({ moeda: x.moeda, valor: Number(x.valor) })),
    semValor: Number(totais.sem_valor),
    abertas: Number(totais.abertas),
    criadas,
    ganhas: ganhas.length,
    conversao: criadas > 0 ? Number(totais.criadas_ganhas) / criadas : null,
    ticketMedio,
    cicloMedioDias: ganhas.length ? arred(ganhas.reduce((s, g) => s + Number(g.dias), 0) / ganhas.length) : null,
  };
}
