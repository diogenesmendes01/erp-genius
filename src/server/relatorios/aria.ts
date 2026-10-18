import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EscopoRelatorio } from "./escopo";
import type { FiltrosRelatorio } from "./pipeline";
import { atendimentosComerciais, ORIGENS_ATENDIMENTO } from "./atendimento";

export interface LadoComparacao {
  atendimentos: number;
  conversao: number | null;
  primeiraRespostaMediaMin: number | null;
  perdidosSemResposta: number;
}

export interface MetricasAriaEquipe {
  aria: LadoComparacao;
  equipe: LadoComparacao;
  taxaHandoff: number | null;
  sugestoesAprovadas: number | null;
  etapasAvancadasAria: number;
}

const arred = (n: number, casas = 2) => Math.round(n * 10 ** casas) / 10 ** casas;
const vazio = (): LadoComparacao => ({ atendimentos: 0, conversao: null, primeiraRespostaMediaMin: null, perdidosSemResposta: 0 });

/**
 * Aria × equipe. Cada atendimento comercial do período pertence ao lado de sua PRIMEIRA saída
 * (`IA` = Aria; `HUMANO` e `CELULAR` = equipe); atendimento sem saída não entra em nenhum lado.
 * `conversao`: das oportunidades do lado, a fração hoje MATRICULADO. Escopo igual ao de `metricasAtendimento`,
 * então o vendedor só vê o lado da equipe dos próprios atendimentos.
 */
export async function metricasAriaEquipe(f: FiltrosRelatorio, e: EscopoRelatorio): Promise<MetricasAriaEquipe> {
  const cond = atendimentosComerciais(f, e);
  const origens = Prisma.join([...ORIGENS_ATENDIMENTO]);
  const base = Prisma.sql`SELECT a.id, a."leadId", a."primeiroInboundEm" AS pin, a."primeiraRespostaEm" AS pr,
      l.etapa::text AS etapa, l."motivoPerda"::text AS motivo
    FROM "AtendimentoWhatsApp" a LEFT JOIN "Lead" l ON l.id = a."leadId" WHERE ${cond}`;

  const lados = await prisma.$queryRaw<
    { lado: string; atendimentos: bigint; leads: bigint; ganhos: bigint; media: number | null; perdidos: bigint }[]
  >(Prisma.sql`
    WITH b AS (${base}),
    prim AS (
      SELECT DISTINCT ON (m."atendimentoId") m."atendimentoId" AS aid, m.origem::text AS origem, m."criadoEm" AS em
      FROM "MensagemWhatsApp" m JOIN b ON b.id = m."atendimentoId"
      WHERE m.direcao::text = 'SAIDA' AND m.origem::text IN (${origens})
      ORDER BY m."atendimentoId", m."criadoEm", m.id
    ),
    x AS (
      SELECT b.*, prim.em, CASE WHEN prim.origem = 'IA' THEN 'ARIA' ELSE 'EQUIPE' END AS lado
      FROM b JOIN prim ON prim.aid = b.id
    )
    SELECT lado, COUNT(*) AS atendimentos, COUNT(DISTINCT "leadId") AS leads,
           COUNT(DISTINCT "leadId") FILTER (WHERE etapa = 'MATRICULADO') AS ganhos,
           AVG(EXTRACT(EPOCH FROM (CASE WHEN lado = 'EQUIPE' THEN COALESCE(pr, em) ELSE em END - pin)) / 60.0)
             FILTER (WHERE pin IS NOT NULL AND (CASE WHEN lado = 'EQUIPE' THEN COALESCE(pr, em) ELSE em END) >= pin) AS media,
           COUNT(*) FILTER (WHERE etapa = 'PERDIDO' AND motivo = 'NAO_RESPONDEU') AS perdidos
    FROM x GROUP BY lado`);

  const lado = (nome: string): LadoComparacao => {
    const r = lados.find((x) => x.lado === nome);
    if (!r) return vazio();
    return {
      atendimentos: Number(r.atendimentos),
      conversao: Number(r.leads) > 0 ? arred(Number(r.ganhos) / Number(r.leads)) : null,
      primeiraRespostaMediaMin: r.media == null ? null : arred(Number(r.media)),
      perdidosSemResposta: Number(r.perdidos),
    };
  };
  const aria = lado("ARIA");
  const equipe = lado("EQUIPE");

  const [acoes] = await prisma.$queryRaw<{ handoff: bigint; aprovadas: bigint; decididas: bigint; etapas: bigint }[]>(Prisma.sql`
    WITH b AS (${base}),
    prim AS (
      SELECT DISTINCT ON (m."atendimentoId") m."atendimentoId" AS aid, m.origem::text AS origem
      FROM "MensagemWhatsApp" m JOIN b ON b.id = m."atendimentoId"
      WHERE m.direcao::text = 'SAIDA' AND m.origem::text IN (${origens})
      ORDER BY m."atendimentoId", m."criadoEm", m.id
    )
    SELECT
      COUNT(DISTINCT ac."atendimentoId") FILTER (WHERE ac.acao::text = 'HANDOFF' AND ac.status::text IN ('EXECUTADA', 'APROVADA')
        AND ac."atendimentoId" IN (SELECT aid FROM prim WHERE origem = 'IA')) AS handoff,
      COUNT(*) FILTER (WHERE ac.status::text = 'APROVADA') AS aprovadas,
      COUNT(*) FILTER (WHERE ac.status::text IN ('APROVADA', 'REJEITADA', 'EXPIRADA')) AS decididas,
      COUNT(*) FILTER (WHERE ac.acao::text = 'MOVER_ETAPA' AND ac.status::text IN ('EXECUTADA', 'APROVADA')) AS etapas
    FROM "AcaoAgenteIA" ac JOIN b ON b.id = ac."atendimentoId"`);

  return {
    aria,
    equipe,
    taxaHandoff: aria.atendimentos > 0 ? arred(Number(acoes.handoff) / aria.atendimentos) : null,
    sugestoesAprovadas: Number(acoes.decididas) > 0 ? arred(Number(acoes.aprovadas) / Number(acoes.decididas)) : null,
    etapasAvancadasAria: Number(acoes.etapas),
  };
}
