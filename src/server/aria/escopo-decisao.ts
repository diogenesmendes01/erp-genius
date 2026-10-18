import { Papel, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "../_shared";
import { escopoComercialAtual } from "../_shared/escopo-comercial";

// Quem pode decidir (aprovar/rejeitar/desfazer) uma ação da Aria. Um só critério para o Histórico
// e para as sugestões do Inbox: o lead da ação (a oportunidade da ação ou, sem ela, o lead do
// atendimento) tem de estar no escopo comercial atual; ação sem lead é só do Administrador.

type Db = Prisma.TransactionClient | typeof prisma;

export interface AlvoDecisaoAria {
  oportunidadeId: string | null;
  atendimentoId: string | null;
}

export async function leadDaAcaoAria(db: Db, alvo: AlvoDecisaoAria): Promise<string | null> {
  if (alvo.oportunidadeId) return alvo.oportunidadeId;
  if (!alvo.atendimentoId) return null;
  return (await db.atendimentoWhatsApp.findUnique({ where: { id: alvo.atendimentoId }, select: { leadId: true } }))?.leadId ?? null;
}

/** Devolve, entre os leads informados (null = ação sem lead), os que o usuário pode decidir. */
export async function leadsDecidiveis(db: Db, u: UsuarioSessao, leadIds: (string | null)[]): Promise<Set<string | null>> {
  const ok = new Set<string | null>();
  if (leadIds.includes(null) && u.papeis.includes(Papel.ADMINISTRADOR)) ok.add(null);
  const ids = [...new Set(leadIds.filter((x): x is string => !!x))];
  if (ids.length) {
    const visiveis = await db.oportunidade.findMany({ where: { AND: [{ id: { in: ids } }, await escopoComercialAtual(u, db)] }, select: { id: true } });
    for (const v of visiveis) ok.add(v.id);
  }
  return ok;
}

export async function podeDecidirAcaoAria(db: Db, u: UsuarioSessao, alvo: AlvoDecisaoAria): Promise<boolean> {
  const leadId = await leadDaAcaoAria(db, alvo);
  return (await leadsDecidiveis(db, u, [leadId])).has(leadId);
}
