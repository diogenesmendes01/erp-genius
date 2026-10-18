import { MotivoPerda, EtapaLead as EtapasLead, Prisma, type EtapaLead } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EscopoRelatorio } from "./escopo";
import { condicoesLead, instanteUtc, type FiltrosRelatorio } from "./pipeline";

export type ChaveDetalhe =
  | "abertas"
  | "ganhas"
  | "perdidas"
  | `etapa:${EtapaLead}`
  | `perda:${MotivoPerda}`
  | `responsavel:${string}`
  | `origem:${string}`;

export interface ItemDetalhe {
  id: string;
  nome: string;
  etapa: EtapaLead;
  responsavel: string | null;
  valor: number | null;
  moeda: string | null;
  diasDesdeCriacao: number;
  href: string;
}

export const LIMITE_DETALHE = 200;

/** Filtros do relatório + busca por nome (texto livre, só no painel de oportunidades). */
export type FiltrosDetalhe = FiltrosRelatorio & { busca?: string };

/** Valida a chave vinda da URL; devolve null se não for uma chave conhecida. */
export function lerChaveDetalhe(s: string | null | undefined): ChaveDetalhe | null {
  if (!s) return null;
  if (s === "abertas" || s === "ganhas" || s === "perdidas") return s;
  const i = s.indexOf(":");
  if (i < 0) return null;
  const tipo = s.slice(0, i);
  const valor = s.slice(i + 1);
  if (!valor) return null;
  if (tipo === "etapa") return (Object.values(EtapasLead) as string[]).includes(valor) ? (s as ChaveDetalhe) : null;
  if (tipo === "perda") return (Object.values(MotivoPerda) as string[]).includes(valor) ? (s as ChaveDetalhe) : null;
  if (tipo === "responsavel" || tipo === "origem") return s as ChaveDetalhe;
  return null;
}

const FECHADAS = Prisma.sql`l.etapa::text NOT IN ('MATRICULADO', 'PERDIDO')`;

function condicaoDaChave(chave: ChaveDetalhe, f: FiltrosRelatorio): Prisma.Sql {
  const ini = instanteUtc(f.periodo.inicio);
  const fim = instanteUtc(f.periodo.fim);
  const noPeriodo = Prisma.sql`l."criadoEm" >= ${ini} AND l."criadoEm" < ${fim}`;
  if (chave === "abertas") return FECHADAS;
  if (chave === "ganhas") {
    return Prisma.sql`l.id IN (
      SELECT ev."agregadoId" FROM "Evento" ev
      WHERE ev."agregadoTipo" = 'Lead' AND ev.tipo = 'EtapaAlterada' AND ev.payload ->> 'para' = 'MATRICULADO'
      GROUP BY ev."agregadoId" HAVING MIN(ev."criadoEm") >= ${ini} AND MIN(ev."criadoEm") < ${fim})`;
  }
  const perdida = (motivo?: string) => Prisma.sql`l.id IN (
      SELECT ev."agregadoId" FROM "Evento" ev
      WHERE ev."agregadoTipo" = 'Lead' AND ev.tipo = 'LeadPerdido' AND ev."criadoEm" >= ${ini} AND ev."criadoEm" < ${fim}
      ${motivo ? Prisma.sql`AND COALESCE(ev.payload ->> 'motivoPerda', 'OUTRO') = ${motivo}` : Prisma.empty})`;
  if (chave === "perdidas") return perdida();
  const [tipo, ...resto] = chave.split(":");
  const valor = resto.join(":");
  if (tipo === "perda") return perdida(valor);
  if (tipo === "etapa") return Prisma.sql`l.etapa::text = ${valor}`;
  if (tipo === "responsavel") return Prisma.sql`${noPeriodo} AND l."vendedorDonoId" = ${valor}`;
  return Prisma.sql`${noPeriodo} AND l."origemCanal"::text = ${valor}`;
}

const escaparLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Oportunidades por trás de um número do relatório (até 200, mais recentes primeiro), dentro do escopo do papel
 * e dos mesmos filtros. Não devolve telefone, e-mail nem documento.
 */
export async function detalharMetrica(chave: ChaveDetalhe, f: FiltrosDetalhe, e: EscopoRelatorio): Promise<{ total: number; itens: ItemDetalhe[] }> {
  const partes = [condicoesLead(f, e), condicaoDaChave(chave, f)];
  const busca = f.busca?.trim();
  if (busca) partes.push(Prisma.sql`l.nome ILIKE ${`%${escaparLike(busca)}%`}`);
  const onde = Prisma.join(partes.map((p) => Prisma.sql`(${p})`), " AND ");

  const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS n FROM "Lead" l WHERE ${onde}`);
  const linhas = await prisma.$queryRaw<{ id: string; nome: string; etapa: EtapaLead; responsavel: string | null; valor: number | null; moeda: string | null; dias: number }[]>(Prisma.sql`
    SELECT l.id, l.nome, l.etapa::text AS etapa, u.nome AS responsavel, l."valorPrevisto"::float8 AS valor,
           p."moedaLocal" AS moeda, EXTRACT(EPOCH FROM (NOW() - l."criadoEm")) / 86400.0 AS dias
    FROM "Lead" l
    LEFT JOIN "Usuario" u ON u.id = l."vendedorDonoId"
    LEFT JOIN "Pais" p ON p.id = l."paisId"
    WHERE ${onde}
    ORDER BY l."criadoEm" DESC, l.id
    LIMIT ${LIMITE_DETALHE}`);
  return {
    total: Number(n),
    itens: linhas.map((l) => ({
      id: l.id,
      nome: l.nome,
      etapa: l.etapa,
      responsavel: l.responsavel,
      valor: l.valor == null ? null : Number(l.valor),
      moeda: l.moeda,
      diasDesdeCriacao: Math.max(0, Math.floor(Number(l.dias))),
      href: `/oportunidades/${l.id}`,
    })),
  };
}
