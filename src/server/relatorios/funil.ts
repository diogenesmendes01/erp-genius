import { Prisma, type EtapaLead, type MotivoPerda } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EscopoRelatorio } from "./escopo";
import { condicoesLead, instanteUtc, type FiltrosRelatorio } from "./pipeline";

/** Linha principal do funil, em ordem. NO_SHOW e PERDIDO ficam fora da linha. */
export const ETAPAS_FUNIL: EtapaLead[] = [
  "NOVO",
  "EM_ATENDIMENTO",
  "QUALIFICADO",
  "EXPERIMENTAL_AGENDADA",
  "EXPERIMENTAL_REALIZADA",
  "PROPOSTA",
  "AGUARDANDO_MATRICULA",
  "MATRICULADO",
];

export interface EtapaFunil {
  etapa: EtapaLead;
  chegaram: number;
  agora: number;
  conversaoProxima: number | null;
  tempoMedioDias: number | null;
}

export interface PerdaFunil {
  motivo: MotivoPerda;
  quantidade: number;
  etapaMaisComum: EtapaLead | null;
}

const arred = (n: number) => Math.round(n * 100) / 100;

/**
 * Linha do tempo de etapa de cada oportunidade, reconstruída dos eventos do agregado Lead
 * (`EtapaAlterada.para`, `PropostaEnviada`, `ExperimentalAgendada/Realizada`, `NoShow`, `LeadPerdido`),
 * com NOVO na criação. Repetições consecutivas da mesma etapa colapsam em uma visita.
 */
function visitasCte(f: FiltrosRelatorio, e: EscopoRelatorio): Prisma.Sql {
  return Prisma.sql`
    lf AS (SELECT l.id, l."criadoEm" FROM "Lead" l WHERE ${condicoesLead(f, e)}),
    ev AS (
      SELECT lf.id AS lid, lf."criadoEm" AS em, 0 AS ord, '' AS eid, 'LeadCriado' AS tipo, 'NOVO' AS etapa, NULL::text AS motivo FROM lf
      UNION ALL
      SELECT ev0."agregadoId", ev0."criadoEm", 1, ev0.id, ev0.tipo,
             CASE ev0.tipo
               WHEN 'EtapaAlterada' THEN ev0.payload ->> 'para'
               WHEN 'PropostaEnviada' THEN 'PROPOSTA'
               WHEN 'ExperimentalAgendada' THEN 'EXPERIMENTAL_AGENDADA'
               WHEN 'ExperimentalRealizada' THEN 'EXPERIMENTAL_REALIZADA'
               WHEN 'NoShow' THEN 'NO_SHOW'
               WHEN 'LeadPerdido' THEN 'PERDIDO'
             END,
             ev0.payload ->> 'motivoPerda'
      FROM "Evento" ev0 JOIN lf ON lf.id = ev0."agregadoId"
      WHERE ev0."agregadoTipo" = 'Lead'
        AND ev0.tipo IN ('EtapaAlterada', 'PropostaEnviada', 'ExperimentalAgendada', 'ExperimentalRealizada', 'NoShow', 'LeadPerdido')
    ),
    ev2 AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY lid ORDER BY em, ord, eid) AS rn
      FROM ev
      WHERE etapa IN ('NOVO', 'EM_ATENDIMENTO', 'QUALIFICADO', 'EXPERIMENTAL_AGENDADA', 'EXPERIMENTAL_REALIZADA', 'PROPOSTA', 'AGUARDANDO_MATRICULA', 'MATRICULADO', 'NO_SHOW', 'PERDIDO')
    ),
    ev3 AS (SELECT *, LAG(etapa) OVER (PARTITION BY lid ORDER BY rn) AS anterior FROM ev2),
    vis0 AS (SELECT lid, etapa, em AS entrada, rn FROM ev3 WHERE anterior IS DISTINCT FROM etapa),
    vis AS (
      SELECT v.lid, v.etapa, v.entrada, v.rn,
             LEAD(v.entrada) OVER (PARTITION BY v.lid ORDER BY v.rn) AS saida,
             CASE v.etapa
               WHEN 'NOVO' THEN 0 WHEN 'EM_ATENDIMENTO' THEN 1 WHEN 'QUALIFICADO' THEN 2
               WHEN 'EXPERIMENTAL_AGENDADA' THEN 3 WHEN 'NO_SHOW' THEN 3 WHEN 'EXPERIMENTAL_REALIZADA' THEN 4
               WHEN 'PROPOSTA' THEN 5 WHEN 'AGUARDANDO_MATRICULA' THEN 6 WHEN 'MATRICULADO' THEN 7
             END AS idx
      FROM vis0 v
    )`;
}

/**
 * Funil por eventos de etapa, no período.
 * - `chegaram`: oportunidades que entraram na etapa no período; pular etapas conta as puladas
 *   (a entrada numa etapa é o primeiro instante em que a oportunidade chegou nela ou além dela).
 * - `agora`: oportunidades hoje nessa etapa (retrato atual, no escopo/filtros).
 * - `conversaoProxima`: das que entraram na etapa no período, a parcela que já chegou à seguinte; null sem base.
 * - `tempoMedioDias`: tempo parado na etapa (soma de todas as visitas já encerradas, idas e voltas), média por oportunidade.
 * - `perdas`: LeadPerdido no período, por motivo, com a etapa onde mais pararam (a etapa anterior à perda).
 */
export async function metricasFunil(f: FiltrosRelatorio, e: EscopoRelatorio): Promise<{ etapas: EtapaFunil[]; perdas: PerdaFunil[] }> {
  const ini = instanteUtc(f.periodo.inicio);
  const fim = instanteUtc(f.periodo.fim);
  const cte = visitasCte(f, e);
  const mapa = Prisma.join(ETAPAS_FUNIL.map((n, i) => Prisma.sql`(${i}, ${n})`));

  const linhas = await prisma.$queryRaw<{ idx: number; chegaram: bigint; avancaram: bigint; tempo: number | null }[]>(Prisma.sql`
    WITH ${cte},
    mapa(idx, etapa) AS (VALUES ${mapa}),
    maximo AS (SELECT lid, MAX(idx) AS maxidx FROM vis WHERE idx IS NOT NULL GROUP BY lid),
    entrada AS (
      SELECT v.lid, m.idx, MIN(v.entrada) AS em
      FROM vis v JOIN mapa m ON v.idx >= m.idx
      GROUP BY v.lid, m.idx
    ),
    base AS (
      SELECT en.lid, en.idx, mx.maxidx FROM entrada en JOIN maximo mx ON mx.lid = en.lid
      WHERE en.em >= ${ini} AND en.em < ${fim}
    ),
    parado AS (
      SELECT v.lid, m.idx, SUM(EXTRACT(EPOCH FROM (v.saida - v.entrada))) / 86400.0 AS dias
      FROM vis v JOIN mapa m ON m.etapa = v.etapa
      WHERE v.saida IS NOT NULL
      GROUP BY v.lid, m.idx
    )
    SELECT m.idx,
           COUNT(b.lid) AS chegaram,
           COUNT(b.lid) FILTER (WHERE b.maxidx >= m.idx + 1) AS avancaram,
           AVG(p.dias)::float8 AS tempo
    FROM mapa m
    LEFT JOIN base b ON b.idx = m.idx
    LEFT JOIN parado p ON p.lid = b.lid AND p.idx = m.idx
    GROUP BY m.idx ORDER BY m.idx`);

  const atuais = await prisma.$queryRaw<{ etapa: string; n: bigint }[]>(Prisma.sql`
    SELECT l.etapa::text AS etapa, COUNT(*) AS n FROM "Lead" l WHERE ${condicoesLead(f, e)} GROUP BY l.etapa`);
  const agora = new Map(atuais.map((a) => [a.etapa, Number(a.n)]));

  const etapas: EtapaFunil[] = ETAPAS_FUNIL.map((etapa, i) => {
    const l = linhas.find((x) => Number(x.idx) === i);
    const chegaram = l ? Number(l.chegaram) : 0;
    const ultima = i === ETAPAS_FUNIL.length - 1;
    return {
      etapa,
      chegaram,
      agora: agora.get(etapa) ?? 0,
      conversaoProxima: ultima || chegaram === 0 ? null : Number(l!.avancaram) / chegaram,
      tempoMedioDias: l?.tempo == null ? null : arred(Number(l.tempo)),
    };
  });

  // Perdas: a última perda de cada oportunidade no período; etapa = visita anterior à perda.
  const perdasBrutas = await prisma.$queryRaw<{ motivo: string | null; etapa: string | null }[]>(Prisma.sql`
    WITH ${cte},
    ult AS (
      SELECT DISTINCT ON (e2.lid) e2.lid, e2.em, e2.rn, e2.motivo
      FROM ev2 e2
      WHERE e2.tipo = 'LeadPerdido' AND e2.em >= ${ini} AND e2.em < ${fim}
      ORDER BY e2.lid, e2.rn DESC
    )
    SELECT u.motivo,
           (SELECT v.etapa FROM vis v WHERE v.lid = u.lid AND v.etapa <> 'PERDIDO' AND v.rn < u.rn ORDER BY v.rn DESC LIMIT 1) AS etapa
    FROM ult u`);

  const porMotivo = new Map<string, { total: number; etapas: Map<string, number> }>();
  for (const p of perdasBrutas) {
    const motivo = p.motivo ?? "OUTRO";
    const acc = porMotivo.get(motivo) ?? { total: 0, etapas: new Map() };
    acc.total += 1;
    if (p.etapa) acc.etapas.set(p.etapa, (acc.etapas.get(p.etapa) ?? 0) + 1);
    porMotivo.set(motivo, acc);
  }
  const ordem = (et: string) => ["NOVO", "EM_ATENDIMENTO", "QUALIFICADO", "EXPERIMENTAL_AGENDADA", "NO_SHOW", "EXPERIMENTAL_REALIZADA", "PROPOSTA", "AGUARDANDO_MATRICULA", "MATRICULADO"].indexOf(et);
  const perdas: PerdaFunil[] = [...porMotivo.entries()]
    .map(([motivo, { total, etapas: es }]) => ({
      motivo: motivo as MotivoPerda,
      quantidade: total,
      etapaMaisComum: ([...es.entries()].sort((a, b) => b[1] - a[1] || ordem(a[0]) - ordem(b[0]))[0]?.[0] ?? null) as EtapaLead | null,
    }))
    .sort((a, b) => b.quantidade - a.quantidade || a.motivo.localeCompare(b.motivo));

  return { etapas, perdas };
}
