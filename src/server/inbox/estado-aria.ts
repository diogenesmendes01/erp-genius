import { Prisma, type AcaoAgenteIATipo, type AcaoOrcamentoIA, type EstadoPolitica, type FinalidadeAtendimentoWhatsApp } from "@prisma/client";
import type { Db } from "@/server/whatsapp/escopo";
import { situacaoAria } from "@/server/aria/estado";
import { estadoOrcamento } from "@/server/aria/uso";
import { motivoParaNaoAtuar } from "@/server/aria/turno/guardas";

import type { EstadoAria } from "./estado-aria-valores";
export { ESTADOS_ARIA } from "./estado-aria-valores";
export type { EstadoAria };
export interface ContextoEstadoAria {
  ariaAtiva: boolean;
  handoffPendentes: ReadonlySet<string>;
  agora: Date;
}
export interface LinhaEstadoAria {
  id: string;
  finalidade: FinalidadeAtendimentoWhatsApp;
  encerradoEm: Date | null;
  iaPausadaEm: Date | null;
  responsavelId: string | null;
  grupo: boolean;
  numeroComDono: boolean;
  contatoOptOut: boolean;
}

export function ariaAtivaGlobal(
  s: { estado: EstadoPolitica; pausada: boolean; temVersao: boolean },
  o: { situacao: "OK" | "ALERTA" | "ESTOURADO"; acao: AcaoOrcamentoIA },
): boolean {
  return s.estado === "ATIVA" && !s.pausada && s.temVersao && !(o.situacao === "ESTOURADO" && o.acao === "PAUSAR");
}

export function derivarEstadoAria(a: LinhaEstadoAria, ctx: ContextoEstadoAria, sugestaoPendente: boolean): EstadoAria | null {
  if (a.encerradoEm || a.grupo) return null;
  if (ctx.handoffPendentes.has(a.id)) return "handoff";
  if (a.iaPausadaEm) return "humano";
  if (sugestaoPendente) return "aprovacao";
  if (ctx.ariaAtiva && motivoParaNaoAtuar({
    estado: "ATIVA", pausadaGlobal: false, orcamento: "OK", acaoOrcamento: "PAUSAR",
    conversaDeGrupo: a.grupo, finalidade: a.finalidade, iaPausadaEm: a.iaPausadaEm,
    atendimentoEncerrado: !!a.encerradoEm, contatoOptOut: a.contatoOptOut,
    numeroComDono: a.numeroComDono, mensagemTipo: "TEXTO",
  }) === null) return "ia";
  return a.responsavelId ? "humano" : null;
}

export function linhaEstadoDe(a: {
  id: string; finalidade: FinalidadeAtendimentoWhatsApp; encerradoEm: Date | null;
  iaPausadaEm: Date | null; responsavelId: string | null;
  conversa: { grupoId: string | null; numero: { donoId: string | null }; contato: { optOutEm: Date | null } | null };
}): LinhaEstadoAria {
  return { id: a.id, finalidade: a.finalidade, encerradoEm: a.encerradoEm, iaPausadaEm: a.iaPausadaEm,
    responsavelId: a.responsavelId, grupo: a.conversa.grupoId !== null,
    numeroComDono: a.conversa.numero.donoId !== null, contatoOptOut: a.conversa.contato?.optOutEm != null };
}

export const sugestaoVigente = (agora: Date): Prisma.AcaoAgenteIAWhereInput => ({
  status: "SUGERIDA", OR: [{ expiraEm: null }, { expiraEm: { gt: agora } }],
});

export async function idsHandoffPendente(db: Db, ids?: readonly string[]): Promise<string[]> {
  if (ids?.length === 0) return [];
  const filtro = ids === undefined ? Prisma.empty : Prisma.sql`AND a."id" = ANY(${[...new Set(ids)]}::text[])`;
  const linhas = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT a."id" FROM "AtendimentoWhatsApp" a
    WHERE a."iaPausaMotivo" = 'HANDOFF' AND a."iaPausadaEm" IS NOT NULL AND a."encerradoEm" IS NULL
      ${filtro}
      AND NOT EXISTS (
        SELECT 1 FROM "MensagemWhatsApp" m
        WHERE m."atendimentoId" = a."id" AND m."direcao" = 'SAIDA'
          AND m."origem" IN ('HUMANO', 'CELULAR') AND m."criadoEm" > a."iaPausadaEm"
      )
      AND NOT EXISTS (
        SELECT 1 FROM "Evento" e
        WHERE e."agregadoTipo" = 'AtendimentoWhatsApp' AND e."agregadoId" = a."id"
          AND e."tipo" = 'AtendimentoAssumido' AND e."criadoEm" > a."iaPausadaEm"
      )
  `);
  return linhas.map(a => a.id);
}

export async function carregarContextoAria(db: Db, o: { atendimentoIds?: readonly string[]; agora?: Date } = {}): Promise<ContextoEstadoAria> {
  const agora = o.agora ?? new Date();
  const s = await situacaoAria(agora, db);
  const orcamento = await estadoOrcamento(agora, db);
  return { ariaAtiva: ariaAtivaGlobal({ estado: s.estado, pausada: s.pausada, temVersao: s.versao !== null }, orcamento),
    handoffPendentes: new Set(await idsHandoffPendente(db, o.atendimentoIds)), agora };
}

export async function sugestoesPendentesPorAtendimento(db: Db, ids: readonly string[], agora: Date): Promise<Map<string, { acao: AcaoAgenteIATipo; criadoEm: Date }>> {
  if (ids.length === 0) return new Map();
  const linhas = await db.$queryRaw<{ atendimentoId: string; acao: AcaoAgenteIATipo; criadoEm: Date }[]>(Prisma.sql`
    SELECT DISTINCT ON ("atendimentoId") "atendimentoId", "acao", "criadoEm"
    FROM "AcaoAgenteIA"
    WHERE "atendimentoId" = ANY(${[...new Set(ids)]}::text[]) AND "status" = 'SUGERIDA'
      AND ("expiraEm" IS NULL OR "expiraEm" > ${agora.toISOString()}::timestamp(3))
    ORDER BY "atendimentoId", "criadoEm" DESC, "id" DESC
  `);
  return new Map(linhas.map(({ atendimentoId, acao, criadoEm }) => [atendimentoId, { acao, criadoEm }]));
}

export function condicaoEstadoAria(estado: EstadoAria, ctx: ContextoEstadoAria): Prisma.AtendimentoWhatsAppWhereInput {
  const abertoIndividual: Prisma.AtendimentoWhatsAppWhereInput = { encerradoEm: null, conversa: { grupoId: null } };
  const handoff: Prisma.AtendimentoWhatsAppWhereInput = { id: { in: [...ctx.handoffPendentes] } };
  const sugestao: Prisma.AtendimentoWhatsAppWhereInput = { acoesAgenteIA: { some: sugestaoVigente(ctx.agora) } };
  const elegivel: Prisma.AtendimentoWhatsAppWhereInput = { finalidade: "COMERCIAL", iaPausadaEm: null,
    conversa: { numero: { donoId: null }, OR: [{ contato: { is: null } }, { contato: { is: { optOutEm: null } } }] } };
  switch (estado) {
    case "handoff": return { AND: [abertoIndividual, handoff] };
    case "aprovacao": return { AND: [abertoIndividual, { NOT: handoff }, { iaPausadaEm: null }, sugestao] };
    case "ia": return ctx.ariaAtiva ? { AND: [abertoIndividual, { NOT: handoff }, { NOT: sugestao }, elegivel] } : { id: { in: [] } };
    case "humano": return { AND: [abertoIndividual, { NOT: handoff }, { OR: [
      { iaPausadaEm: { not: null } },
      { AND: [{ responsavelId: { not: null } }, { NOT: sugestao }, ...(ctx.ariaAtiva ? [{ NOT: elegivel }] : [])] },
    ] }] };
  }
}
