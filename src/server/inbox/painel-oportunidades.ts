import { papelEditaPrevisao } from "./previsao-capacidade";
import { carregarTarefasDoAtendimento, type TarefaPainel } from "./painel-tarefas";
import { carregarFusoInstitucionalTx } from "@/server/operacao/relogio";
import { Papel, type EtapaLead, type MotivoPerda, type Temperatura } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { escopoAtendimentos, type Db } from "@/server/whatsapp/escopo";
import { podeVerLeadNaThread } from "@/server/whatsapp/consultas-inbox";

export type OportunidadeAtualPainel = {
  id: string; titulo: string; produto: string | null; valor: string | null; moeda: string | null;
  probabilidadePct: number | null; previsaoFechamento: string | null; podeEditarPrevisao: boolean;
  etapa: EtapaLead; temperatura: Temperatura; responsavel: { id: string; nome: string } | null;
  dataExperimental: string | null; experimentalConfirmada: boolean; professorExperimental: string | null;
  professorExperimentalId?: string | null; atendimentoId?: string; professores?: { id: string; nome: string }[];
  motivoPerda: MotivoPerda | null;
};
export type OutraOportunidadePainel = { id: string; titulo: string; etapa: EtapaLead; valor: string | null; moeda: string | null };
export type ProfessorPainel = { id: string; nome: string };
export type OportunidadesPainel = { atual: OportunidadeAtualPainel | null; outras: OutraOportunidadePainel[]; pessoaId: string | null; tarefas: TarefaPainel[]; fusoEscola: string; professores: ProfessorPainel[]; professorExperimentalId: string | null };
const vazio = (tarefas: TarefaPainel[] = [], fusoEscola = ""): OportunidadesPainel => ({ atual: null, outras: [], pessoaId: null, tarefas, fusoEscola, professores: [], professorExperimentalId: null });

export async function carregarOportunidadesPainel(u: UsuarioSessao, atendimentoId: string, db: Db = prisma): Promise<OportunidadesPainel | null> {
  if (!u?.id) return null;
  if (db === prisma) return prisma.$transaction(tx => carregarOportunidadesPainel(u, atendimentoId, tx));
  const a = await db.atendimentoWhatsApp.findFirst({
    where: { AND: [{ id: atendimentoId }, await escopoAtendimentos(u, { db })] },
    select: { id: true, finalidade: true, leadId: true, conversa: { select: { contatoId: true } } },
  });
  if (!a) return null;
  if (a.finalidade !== "COMERCIAL") return vazio();
  const fusoEscola = await carregarFusoInstitucionalTx(db) ?? "";
  const leadVisivel = a.leadId && a.conversa.contatoId ? await podeVerLeadNaThread(u, a.id, a.leadId, Date.now(), db) : false;
  const tarefas = await carregarTarefasDoAtendimento(u, a, { soDaConversa: false }, db);
  if (!a.leadId || !leadVisivel) return vazio(tarefas, fusoEscola);
  const op = await db.oportunidade.findUnique({
    where: { id: a.leadId },
    select: {
      id: true, nome: true, pessoaId: true, probabilidadePct: true, previsaoFechamento: true, planoPrevisto: true, valorPrevisto: true, etapa: true, temperatura: true, motivoPerda: true,
      dataExperimental: true, experimentalConfirmadaEm: true, professorExperimentalId: true, pais: { select: { moedaLocal: true } },
      vendedor: { select: { id: true, nome: true } }, professorExperimental: { select: { id: true, nome: true } },
    },
  });
  if (!op) return vazio(tarefas, fusoEscola);
  const professores = await db.usuario.findMany({ where: { ativo: true, papeis: { has: Papel.PROFESSOR } }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  const podeEditarPrevisao = papelEditaPrevisao(u) && !!await db.oportunidade.findFirst({where:{AND:[{id:op.id},await escopoComercialAtual(u,db)]},select:{id:true}});
  const outras = op.pessoaId ? await db.oportunidade.findMany({
    where: { AND: [{ pessoaId: op.pessoaId, id: { not: op.id } }, await escopoComercialAtual(u, db)] },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }], take: 10,
    select: { id: true, nome: true, etapa: true, valorPrevisto: true, pais: { select: { moedaLocal: true } } },
  }) : [];
  return {
    atual: {
      id: op.id, titulo: op.nome, produto: op.planoPrevisto, valor: op.valorPrevisto?.toFixed(2) ?? null, moeda: op.pais?.moedaLocal ?? null,
      probabilidadePct: op.probabilidadePct, previsaoFechamento: op.previsaoFechamento, podeEditarPrevisao,
      etapa: op.etapa, temperatura: op.temperatura, responsavel: op.vendedor, dataExperimental: op.dataExperimental?.toISOString() ?? null,
      experimentalConfirmada: op.experimentalConfirmadaEm !== null, professorExperimental: op.professorExperimental?.nome ?? null,
      professorExperimentalId: op.professorExperimentalId ?? null, atendimentoId, professores, motivoPerda: op.motivoPerda,
    },
    outras: outras.map(o => ({ id: o.id, titulo: o.nome, etapa: o.etapa, valor: o.valorPrevisto?.toFixed(2) ?? null, moeda: o.pais?.moedaLocal ?? null })),
    pessoaId: op.pessoaId, tarefas, fusoEscola, professores, professorExperimentalId: op.professorExperimentalId ?? null,
  };
}