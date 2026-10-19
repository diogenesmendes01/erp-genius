import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EscopoRelatorio } from "./escopo";
import { instanteUtc, type FiltrosRelatorio } from "./pipeline";

const FUSO_PADRAO = "America/Sao_Paulo";
/** Origens de saída que contam como atendimento: a Aria (IA) e a equipe (ERP ou celular). */
export const ORIGENS_ATENDIMENTO = ["IA", "HUMANO", "CELULAR"] as const;
const HORA_INICIAL_CALOR = 7;
const HORAS_CALOR = 15; // 7h–21h

export interface MetricasAtendimento {
  conversas: number;
  primeiraRespostaMediaMin: number | null;
  prazoEstourado: number;
  /** Pendência: a Fase 3 não tem horário de funcionamento por setor; enquanto não houver, fica null. */
  foraDoHorarioPct: number | null;
  volume: { dia: string; aria: number; equipe: number }[];
  /** 7 dias (0 = domingo … 6 = sábado) × 15 horas (7h–21h), mensagens recebidas no fuso da escola. */
  calor: number[][];
}

/** Fuso institucional (padrão America/Sao_Paulo); `db` permite ler pelo tx do chamador. */
export async function fusoDaEscola(db: Pick<Prisma.TransactionClient, "configuracaoOperacional"> = prisma): Promise<string> {
  const c = await db.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } });
  return c?.fusoInstitucional ?? FUSO_PADRAO;
}

/**
 * Atendimentos COMERCIAIS do período (entrada = 1º inbound, ou criação) dentro do escopo:
 * `responsavelId` do atendimento OU `vendedorDonoId` da oportunidade ligada. Alias `a` e `l` (Lead).
 */
export function atendimentosComerciais(f: FiltrosRelatorio, e: EscopoRelatorio): Prisma.Sql {
  const partes: Prisma.Sql[] = [
    Prisma.sql`a.finalidade::text = 'COMERCIAL'`,
    Prisma.sql`COALESCE(a."primeiroInboundEm", a."criadoEm") >= ${instanteUtc(f.periodo.inicio)}`,
    Prisma.sql`COALESCE(a."primeiroInboundEm", a."criadoEm") < ${instanteUtc(f.periodo.fim)}`,
  ];
  if (e.tipo === "USUARIOS") {
    partes.push(
      e.ids.length
        ? Prisma.sql`(a."responsavelId" IN (${Prisma.join(e.ids)}) OR l."vendedorDonoId" IN (${Prisma.join(e.ids)}))`
        : Prisma.sql`FALSE`,
    );
  }
  if (f.responsavelId) partes.push(Prisma.sql`(a."responsavelId" = ${f.responsavelId} OR l."vendedorDonoId" = ${f.responsavelId})`);
  if (f.origem) partes.push(Prisma.sql`l."origemCanal"::text = ${f.origem}`);
  if (f.temperatura) partes.push(Prisma.sql`l."temperatura"::text = ${f.temperatura}`);
  return Prisma.join(partes, " AND ");
}

const arred = (n: number) => Math.round(n * 100) / 100;

/**
 * Atendimento comercial: conversas, primeira resposta (coluna `primeiraRespostaEm` da Fase 3, só resposta
 * humana — ERP ou celular), prazo estourado, volume por dia (Aria × equipe) e calor de entrada por dia da
 * semana × hora, tudo no fuso da escola. `foraDoHorarioPct` é null (sem horário por setor na Fase 3).
 */
export async function metricasAtendimento(f: FiltrosRelatorio, e: EscopoRelatorio): Promise<MetricasAtendimento> {
  const fuso = await fusoDaEscola();
  const cond = atendimentosComerciais(f, e);
  const ini = instanteUtc(f.periodo.inicio);
  const fim = instanteUtc(f.periodo.fim);
  const base = Prisma.sql`SELECT a.id, a."primeiroInboundEm" AS pin, a."primeiraRespostaEm" AS pr, a."prazoRespostaEm" AS prazo
    FROM "AtendimentoWhatsApp" a LEFT JOIN "Lead" l ON l.id = a."leadId" WHERE ${cond}`;

  const [tot] = await prisma.$queryRaw<{ conversas: bigint; media: number | null; estourado: bigint }[]>(Prisma.sql`
    WITH b AS (${base})
    SELECT COUNT(*) AS conversas,
           AVG(EXTRACT(EPOCH FROM (pr - pin)) / 60.0) FILTER (WHERE pin IS NOT NULL AND pr IS NOT NULL AND pr >= pin) AS media,
           COUNT(*) FILTER (WHERE prazo IS NOT NULL AND ((pr IS NOT NULL AND pr > prazo) OR (pr IS NULL AND prazo < (now() AT TIME ZONE 'UTC')))) AS estourado
    FROM b`);

  const vol = await prisma.$queryRaw<{ dia: string; aria: bigint; equipe: bigint }[]>(Prisma.sql`
    WITH b AS (${base})
    SELECT to_char((m."criadoEm" AT TIME ZONE 'UTC') AT TIME ZONE ${fuso}, 'YYYY-MM-DD') AS dia,
           COUNT(*) FILTER (WHERE m.origem::text = 'IA') AS aria,
           COUNT(*) FILTER (WHERE m.origem::text IN ('HUMANO', 'CELULAR')) AS equipe
    FROM "MensagemWhatsApp" m JOIN b ON b.id = m."atendimentoId"
    WHERE m.direcao::text = 'SAIDA' AND m.origem::text IN ('IA', 'HUMANO', 'CELULAR')
      AND m."criadoEm" >= ${ini} AND m."criadoEm" < ${fim}
    GROUP BY 1 ORDER BY 1`);

  const entradas = await prisma.$queryRaw<{ dow: number; hora: number; n: bigint }[]>(Prisma.sql`
    WITH b AS (${base})
    SELECT EXTRACT(DOW FROM loc)::int AS dow, EXTRACT(HOUR FROM loc)::int AS hora, COUNT(*) AS n
    FROM (SELECT (m."criadoEm" AT TIME ZONE 'UTC') AT TIME ZONE ${fuso} AS loc
          FROM "MensagemWhatsApp" m JOIN b ON b.id = m."atendimentoId"
          WHERE m.direcao::text = 'ENTRADA' AND m."criadoEm" >= ${ini} AND m."criadoEm" < ${fim}) x
    GROUP BY 1, 2`);
  const calor = Array.from({ length: 7 }, () => new Array<number>(HORAS_CALOR).fill(0));
  for (const r of entradas) {
    const col = r.hora - HORA_INICIAL_CALOR;
    if (col >= 0 && col < HORAS_CALOR) calor[r.dow][col] += Number(r.n);
  }

  return {
    conversas: Number(tot.conversas),
    primeiraRespostaMediaMin: tot.media == null ? null : arred(Number(tot.media)),
    prazoEstourado: Number(tot.estourado),
    foraDoHorarioPct: null,
    volume: vol.map((r) => ({ dia: r.dia, aria: Number(r.aria), equipe: Number(r.equipe) })),
    calor,
  };
}
