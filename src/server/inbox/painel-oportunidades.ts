import type { EtapaLead, MotivoPerda, Temperatura } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { escopoAtendimentos, type Db } from "@/server/whatsapp/escopo";
import { podeVerLeadNaThread } from "@/server/whatsapp/consultas-inbox";

export type OportunidadeAtualPainel = {
  id: string; titulo: string; produto: string | null; valor: string | null; moeda: string | null;
  etapa: EtapaLead; temperatura: Temperatura; responsavel: { id: string; nome: string } | null;
  dataExperimental: string | null; experimentalConfirmada: boolean; professorExperimental: string | null; motivoPerda: MotivoPerda | null;
};
export type OutraOportunidadePainel = { id: string; titulo: string; etapa: EtapaLead; valor: string | null; moeda: string | null };
export type OportunidadesPainel = { atual: OportunidadeAtualPainel | null; outras: OutraOportunidadePainel[]; pessoaId: string | null };
const vazio = (): OportunidadesPainel => ({ atual: null, outras: [], pessoaId: null });

/** Só leitura; todas as alçadas usam Db fornecida, sem locks ou fallback por Pessoa do Contato. */
export async function carregarOportunidadesPainel(u: UsuarioSessao, atendimentoId: string, db: Db = prisma): Promise<OportunidadesPainel | null> {
  if (!u?.id) return null;
  const a = await db.atendimentoWhatsApp.findFirst({
    where: { AND: [{ id: atendimentoId }, await escopoAtendimentos(u, { db })] },
    select: { id: true, finalidade: true, leadId: true, conversa: { select: { contatoId: true } } },
  });
  if (!a) return null;
  if (a.finalidade !== "COMERCIAL" || !a.leadId || !a.conversa.contatoId || !await podeVerLeadNaThread(u, a.id, a.leadId, Date.now(), db)) return vazio();
  const op = await db.oportunidade.findUnique({
    where: { id: a.leadId },
    select: {
      id: true, nome: true, pessoaId: true, planoPrevisto: true, valorPrevisto: true, etapa: true, temperatura: true, motivoPerda: true,
      dataExperimental: true, experimentalConfirmadaEm: true, pais: { select: { moedaLocal: true } },
      vendedor: { select: { id: true, nome: true } }, professorExperimental: { select: { nome: true } },
    },
  });
  if (!op) return vazio();
  const outras = op.pessoaId ? await db.oportunidade.findMany({
    where: { AND: [{ pessoaId: op.pessoaId, id: { not: op.id } }, await escopoComercialAtual(u, db)] },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }], take: 10,
    select: { id: true, nome: true, etapa: true, valorPrevisto: true, pais: { select: { moedaLocal: true } } },
  }) : [];
  return {
    atual: {
      id: op.id, titulo: op.nome, produto: op.planoPrevisto, valor: op.valorPrevisto?.toFixed(2) ?? null, moeda: op.pais?.moedaLocal ?? null,
      etapa: op.etapa, temperatura: op.temperatura, responsavel: op.vendedor, dataExperimental: op.dataExperimental?.toISOString() ?? null,
      experimentalConfirmada: op.experimentalConfirmadaEm !== null, professorExperimental: op.professorExperimental?.nome ?? null, motivoPerda: op.motivoPerda,
    },
    outras: outras.map(o => ({ id: o.id, titulo: o.nome, etapa: o.etapa, valor: o.valorPrevisto?.toFixed(2) ?? null, moeda: o.pais?.moedaLocal ?? null })),
    pessoaId: op.pessoaId,
  };
}