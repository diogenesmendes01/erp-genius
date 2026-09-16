"use server";
import { isDeepStrictEqual } from "node:util";
import { Papel, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { hashAgendaRecuperacao } from "./recuperacao-agenda-estado";
import { identificarMatriculaAvaliacao } from "./identificacao";

const id = z.string().min(1).max(100), motivo = z.string().trim().min(5).max(2000);
const estadoSchema = z.object({ reservaId: id, matriculaId: id, cancelamentoId: z.string().nullable(), itens: z.array(z.object({
  id, habilidade: z.string(), realizacaoId: z.string().nullable(), encontroId: z.string().nullable(), status: z.string().nullable(), inicio: z.string().nullable(), fim: z.string().nullable(), professorId: z.string().nullable(),
})) });
async function bloquear(tx: Prisma.TransactionClient, reservaId: string, usuarioId: string) {
  const r = await tx.reservaTentativaRecuperacao.findUnique({ where: { id: reservaId }, select: { proposta: { select: { alocacaoId: true } } } });
  if (!r) throw new ErroRegra("Reserva não encontrada.");
  const a = await bloquearLancamento(tx, r.proposta.alocacaoId); await conferirGestorAvaliacao(tx, usuarioId); return a;
}
async function estado(tx: Prisma.TransactionClient, reservaId: string) {
  const [r] = await tx.$queryRaw<{ estado: Prisma.JsonValue }[]>`SELECT estado_cancelamento_agenda_recuperacao(${reservaId}) AS estado`;
  return estadoSchema.parse(r?.estado);
}
function exigirPendente(e: z.infer<typeof estadoSchema>) {
  if (e.cancelamentoId || !e.itens.some(i => i.status === "PREVISTO" && !i.realizacaoId)) throw new ErroRegra("Reserva sem agenda pendente para cancelar.");
}
const propostaSchema = z.object({ reservaId: id, motivo, evidencia: z.string().trim().min(5).max(4000), estadoConferido: z.string().regex(/^[a-f0-9]{64}$/), chaveIdempotencia: z.string().min(8).max(100) }).strict();
export async function proporCancelamentoAgendaRecuperacao(input: z.input<typeof propostaSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = propostaSchema.parse(input);
    return prisma.$transaction(async tx => {
      const a = await bloquear(tx, d.reservaId, u.id), entradaHash = hashAgendaRecuperacao(d);
      const anterior = await tx.propostaCancelamentoAgendaRecuperacao.findUnique({ where: { autorId_chaveIdempotencia: { autorId: u.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (anterior) { if (anterior.entradaHash !== entradaHash) throw new ErroRegra("Chave utilizada com outra proposta."); return { id: anterior.id }; }
      const atual = await estado(tx, d.reservaId); exigirPendente(atual);
      if (hashAgendaRecuperacao(atual) !== d.estadoConferido) throw new ErroRegra("O alcance mudou. Atualize a conferência.");
      const p = await tx.propostaCancelamentoAgendaRecuperacao.create({ data: { reservaId: d.reservaId, autorId: u.id, motivo: d.motivo, evidencia: d.evidencia, snapshot: atual, entradaHash, chaveIdempotencia: d.chaveIdempotencia } });
      await registrarEvento(tx, { tipo: "CancelamentoAgendaRecuperacaoProposto", agregadoTipo: "Matricula", agregadoId: a.matriculaId, autorId: u.id, payload: { propostaId: p.id, reservaId: d.reservaId } });
      return { id: p.id };
    });
  });
}
export async function consultarCancelamentoAgendaRecuperacao(input: { reservaId: string; antesId?: string }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = z.object({ reservaId: id, antesId: id.optional() }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const a = await bloquear(tx, d.reservaId, u.id), atual = await estado(tx, d.reservaId);
      const propostas = await tx.propostaCancelamentoAgendaRecuperacao.findMany({ where: { reservaId: d.reservaId, ...(d.antesId ? { id: { lt: d.antesId } } : {}) }, orderBy: { id: "desc" }, take: 21, include: { autor: { select: { nome: true } }, decisao: { include: { decisor: { select: { nome: true } } } } } });
      return { reservaId: d.reservaId, identificacao: await identificarMatriculaAvaliacao(tx, a.matriculaId, a.turmaId), atual, estadoConferido: hashAgendaRecuperacao(atual),
        podePropor: !atual.cancelamentoId && atual.itens.some(i => i.status === "PREVISTO" && !i.realizacaoId), proximoAntesId: propostas.length > 20 ? propostas[19].id : null,
        propostas: propostas.slice(0,20).map(p => ({ id: p.id, autor: p.autor.nome, motivo: p.motivo, evidencia: p.evidencia, criadaEm: p.criadaEm.toISOString(), origem: estadoSchema.parse(p.snapshot), estadoMudou: !isDeepStrictEqual(p.snapshot, atual),
          estadoConferido: !p.decisao && p.autorId !== u.id ? hashAgendaRecuperacao(p.snapshot) : null,
          decisao: p.decisao ? { aprovada: p.decisao.aprovada, motivo: p.decisao.motivo, decisor: p.decisao.decisor.nome, criadaEm: p.decisao.criadaEm.toISOString() } : null })) };
    });
  });
}
export async function decidirCancelamentoAgendaRecuperacao(input: { propostaId: string; aprovar: boolean; motivo: string; estadoConferido: string }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = z.object({ propostaId: id, aprovar: z.boolean(), motivo, estadoConferido: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const ref = await tx.propostaCancelamentoAgendaRecuperacao.findUnique({ where: { id: d.propostaId }, select: { reservaId: true } });
      if (!ref) throw new ErroRegra("Proposta não encontrada.");
      const a = await bloquear(tx, ref.reservaId, u.id);
      const p = await tx.propostaCancelamentoAgendaRecuperacao.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: true } });
      if (p.autorId === u.id) throw new ErroRegra("Outra pessoa da gestão deve decidir o cancelamento.");
      if (d.estadoConferido !== hashAgendaRecuperacao(p.snapshot)) throw new ErroRegra("Atualize a conferência da proposta.");
      if (p.decisao) {
        if (p.decisao.decisorId !== u.id || p.decisao.aprovada !== d.aprovar || p.decisao.motivo !== d.motivo) throw new ErroRegra("Proposta já decidida.");
        return { id: p.decisao.id };
      }
      if (d.aprovar) {
        const atual = await estado(tx, ref.reservaId); exigirPendente(atual);
        if (!isDeepStrictEqual(p.snapshot, atual)) throw new ErroRegra("A agenda ou realizações mudaram. Prepare nova proposta.");
      }
      const decisao = await tx.decisaoCancelamentoAgendaRecuperacao.create({ data: { propostaId: p.id, decisorId: u.id, aprovada: d.aprovar, motivo: d.motivo } });
      await registrarEvento(tx, { tipo: d.aprovar ? "CancelamentoAgendaRecuperacaoAprovado" : "CancelamentoAgendaRecuperacaoRejeitado", agregadoTipo: "Matricula", agregadoId: a.matriculaId, autorId: u.id, payload: { propostaId: p.id, decisaoId: decisao.id, reservaId: p.reservaId, motivo: d.motivo } });
      return { id: decisao.id };
    });
  });
}
