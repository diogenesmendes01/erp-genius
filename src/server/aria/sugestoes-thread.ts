import { EtapaLead, type AcaoAgenteIATipo, type Prisma } from "@prisma/client";
import type { UsuarioSessao } from "../_shared";
import { sugestaoVigente } from "../inbox/estado-aria";
import type { Db } from "../whatsapp/escopo";
import { acoesDecidiveisNoInbox, type ContextoResponsavelAria } from "./escopo-decisao-inbox";
import { capacidadesAria } from "./permissoes-tela";

export type DetalheSugestao =
  | { tipo: "enviar"; documento: boolean }
  | { tipo: "agendar"; agendadaPara: string }
  | { tipo: "etapa"; para: EtapaLead }
  | { tipo: "tarefa"; titulo: string; venceEm: string }
  | { tipo: "tag"; nome: string }
  | { tipo: "campo"; nome: string; valor: string }
  | { tipo: "perdido"; motivo: string }
  | { tipo: "nota" }
  | { tipo: "condicao"; descontoPct: number; parcelas: number }
  | { tipo: "outro" };

type StatusCartao = "SUGERIDA" | "APROVADA" | "REJEITADA" | "EXPIRADA" | "EXECUTADA" | "DESFEITA";
export interface SugestaoAriaThread {
  id: string;
  turnoId: string;
  acao: AcaoAgenteIATipo;
  status: StatusCartao;
  criadoEm: string;
  expiraEm: string | null;
  justificativa: string | null;
  texto: string | null;
  detalhe: DetalheSugestao;
  decididaPorId: string | null;
  decididaPorNome: string | null;
  decididaEm: string | null;
  podeDecidir?: boolean;
  podeDesfazer?: boolean;
  desfeitaPorId?: string | null;
  desfeitaPorNome?: string | null;
  desfeitaEm?: string | null;
}

const objeto = (p: unknown): Record<string, unknown> | null => p !== null && typeof p === "object" && !Array.isArray(p) ? p as Record<string, unknown> : null;
const dataISO = (v: unknown): string | null => typeof v === "string" && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null;
const etapa = (v: unknown): v is EtapaLead => Object.values(EtapaLead).some(e => e === v);

export function detalheDaSugestao(acao: AcaoAgenteIATipo, payload: unknown): DetalheSugestao {
  const p = objeto(payload);
  if (!p) return { tipo: "outro" };
  switch (acao) {
    case "RESPONDER":
      if (typeof p.texto === "string") return { tipo: "enviar", documento: typeof p.documentoId === "string" && !!p.documentoId };
      break;
    case "ENVIAR_DOCUMENTO":
      if (typeof p.documentoId === "string" && p.documentoId) return { tipo: "enviar", documento: true };
      break;
    case "AGENDAR_MENSAGEM": {
      const agendadaPara = dataISO(p.agendadaPara);
      if (agendadaPara) return { tipo: "agendar", agendadaPara };
      break;
    }
    case "MOVER_ETAPA":
      if (etapa(p.para)) return { tipo: "etapa", para: p.para };
      break;
    case "CRIAR_TAREFA": {
      const venceEm = dataISO(p.venceEmISO);
      if (typeof p.titulo === "string" && venceEm) return { tipo: "tarefa", titulo: p.titulo, venceEm };
      break;
    }
    case "TAG":
      if (typeof p.nome === "string") return { tipo: "tag", nome: p.nome };
      break;
    case "ATUALIZAR_CAMPO":
      if (typeof p.nomeCampo === "string" && (p.para === null || typeof p.para === "string" || typeof p.para === "boolean" || (typeof p.para === "number" && Number.isFinite(p.para)))) return { tipo: "campo", nome: p.nomeCampo, valor: String(p.para ?? "") };
      break;
    case "MARCAR_PERDIDO":
      if (typeof p.motivoPerda === "string") return { tipo: "perdido", motivo: p.motivoPerda };
      break;
    case "NOTA_INTERNA": return { tipo: "nota" };
    case "CONDICAO_COMERCIAL":
      if (typeof p.descontoPct === "number" && Number.isFinite(p.descontoPct) && typeof p.parcelas === "number" && Number.isFinite(p.parcelas)) return { tipo: "condicao", descontoPct: p.descontoPct, parcelas: p.parcelas };
      break;
  }
  return { tipo: "outro" };
}

const statusCartao = (s: string): s is StatusCartao => s === "SUGERIDA" || s === "APROVADA" || s === "REJEITADA" || s === "EXPIRADA" || s === "EXECUTADA" || s === "DESFEITA";

export async function cartoesDaThread(db: Db, usuario: UsuarioSessao, atendimento: ContextoResponsavelAria, agora: Date): Promise<SugestaoAriaThread[]> {
  if (!capacidadesAria(usuario).has("decidirHistorico") && !(usuario.papeis.includes("VENDEDOR") && atendimento.finalidade === "COMERCIAL" && atendimento.responsavelId === usuario.id)) return [];
  const where: Prisma.AcaoAgenteIAWhereInput = {
    atendimentoId: atendimento.id,
    OR: [sugestaoVigente(agora), { status: { in: ["APROVADA", "REJEITADA", "EXPIRADA"] }, decididaEm: { gte: new Date(agora.getTime() - 86_400_000) } }, { status: "EXECUTADA", reversivel: true, criadoEm: { gte: new Date(agora.getTime() - 86_400_000) } }, { status: "DESFEITA", desfeitaEm: { gte: new Date(agora.getTime() - 86_400_000) } }],
  };
  const select = { id: true, turnoId: true, acao: true, status: true, criadoEm: true, expiraEm: true, justificativa: true, payload: true, oportunidadeId: true, decididaPorId: true, decididaEm: true, reversivel: true, desfeitaPorId: true, desfeitaEm: true } as const;
  type Linha = Prisma.AcaoAgenteIAGetPayload<{ select: typeof select }>;
  const autorizadas: Linha[] = [];
  let cursor: { id: string; criadoEm: Date } | null = null;
  for (;;) {
    const pagina: Linha[] = await db.acaoAgenteIA.findMany({
      where: cursor ? { AND: [where, { OR: [{ criadoEm: { gt: cursor.criadoEm } }, { criadoEm: cursor.criadoEm, id: { gt: cursor.id } }] }] } : where,
      orderBy: [{ criadoEm: "asc" }, { id: "asc" }], take: 100, select,
    });
    const permitidas = await acoesDecidiveisNoInbox(db, usuario, atendimento, pagina.map(s => ({ ...s, atendimentoId: atendimento.id })));
    for (const s of pagina) {
      if (permitidas.has(s.id)) autorizadas.push(s);
      if (autorizadas.length === 20) break;
    }
    if (autorizadas.length === 20 || pagina.length < 100) break;
    cursor = pagina[pagina.length - 1];
  }
  const ids = [...new Set(autorizadas.flatMap(s => [s.decididaPorId,s.desfeitaPorId].filter((id): id is string => !!id)))];
  const nomes = new Map(ids.length ? (await db.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } })).map(u => [u.id, u.nome]) : []);
  return autorizadas.flatMap(s => {
    if (!statusCartao(s.status)) return [];
    const p = objeto(s.payload);
    return [{ id: s.id, turnoId: s.turnoId, acao: s.acao, status: s.status, criadoEm: s.criadoEm.toISOString(), expiraEm: s.expiraEm?.toISOString() ?? null, justificativa: s.justificativa, texto: typeof p?.texto === "string" ? p.texto : null, detalhe: detalheDaSugestao(s.acao, s.payload), decididaPorId: s.decididaPorId, decididaPorNome: s.decididaPorId ? nomes.get(s.decididaPorId) ?? null : null, decididaEm: s.decididaEm?.toISOString() ?? null, podeDecidir: s.status === "SUGERIDA", podeDesfazer: s.reversivel && (s.status === "APROVADA" || s.status === "EXECUTADA"), desfeitaPorId: s.desfeitaPorId, desfeitaPorNome: s.desfeitaPorId ? nomes.get(s.desfeitaPorId) ?? null : null, desfeitaEm: s.desfeitaEm?.toISOString() ?? null }];
  });
}
