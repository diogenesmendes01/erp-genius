"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { identificarMatriculaAvaliacao } from "./identificacao";

export async function consultarDesignacaoRecuperacao(input: { itemReservaId: string; buscaProfessor?: string; antesVersao?: number }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ itemReservaId: z.string().min(1).max(100), buscaProfessor: z.string().trim().max(100).default(""), antesVersao: z.number().int().positive().optional() }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const ref = await tx.itemReservaTentativaRecuperacao.findUnique({ where: { id: d.itemReservaId }, select: { reserva: { select: { proposta: { select: { alocacaoId: true } } } } } });
      if (!ref) throw new ErroRegra("Tentativa não encontrada.");
      const a = await bloquearLancamento(tx, ref.reserva.proposta.alocacaoId);
      await conferirGestorAvaliacao(tx, u.id);
      const item = await tx.itemReservaTentativaRecuperacao.findUniqueOrThrow({ where: { id: d.itemReservaId }, select: { id: true, habilidade: true,
        reserva: { select: { propostaId: true, cancelamento: { select: { id: true } } } },
        realizacao: { select: { id: true, professor: { select: { nome: true } }, notas: { where: { decisao: { aprovada: true } }, take: 1, select: { id: true } } } } } });
      const atual = await tx.designacaoRecuperacao.findFirst({ where: { itemReservaId: item.id }, orderBy: { versao: "desc" }, select: { versao: true, professor: { select: { id: true, nome: true, ativo: true, papeis: true } } } });
      const agenda = await tx.encontroAgenda.findFirst({ where: { finalidade: "RECUPERACAO", status: "PREVISTO", propostaAgendaRecuperacao: { itemReservaId: item.id, decisao: { aprovada: true } } }, select: { id: true, inicio: true, professorId: true } });
      const podeAlterar = !agenda && !item.realizacao?.notas.length && (!item.reserva.cancelamento || !!item.realizacao);
      const podeConferirSubstituicao = !!agenda && agenda.inicio > new Date() && !item.realizacao && !item.reserva.cancelamento;
      const professores = podeAlterar || podeConferirSubstituicao ? await tx.usuario.findMany({ where: { ativo: true, papeis: { has: Papel.PROFESSOR }, ...(d.buscaProfessor ? { nome: { contains: d.buscaProfessor, mode: "insensitive" as const } } : {}) }, orderBy: [{ nome: "asc" }, { id: "asc" }], take: 51, select: { id: true, nome: true } }) : [];
      const historico = await tx.designacaoRecuperacao.findMany({ where: { itemReservaId: item.id, ...(d.antesVersao ? { versao: { lt: d.antesVersao } } : {}) }, orderBy: { versao: "desc" }, take: 21,
        select: { id: true, versao: true, motivo: true, criadaEm: true, professor: { select: { nome: true } }, gestor: { select: { nome: true } } } });
      return { itemReservaId: item.id, propostaId: item.reserva.propostaId, habilidade: item.habilidade, identificacao: await identificarMatriculaAvaliacao(tx, a.matriculaId, a.turmaId),
        realizadaPor: item.realizacao?.professor.nome ?? null, podeAlterar, podeConferirSubstituicao, avaliadorAgendaId: agenda?.professorId ?? null, agendaPublicada: !!agenda, versaoEsperada: atual?.versao ?? 0,
        atual: atual?.professor ? { id: atual.professor.id, nome: atual.professor.nome, habilitado: atual.professor.ativo && atual.professor.papeis.includes(Papel.PROFESSOR) } : null,
        professores: professores.slice(0,50), refinarBusca: professores.length > 50, buscaProfessor: d.buscaProfessor,
        historico: historico.slice(0,20).map(h => ({ ...h, criadaEm: h.criadaEm.toISOString() })), proximaAntesVersao: historico.length > 20 ? historico[19].versao : null };
    });
  });
}
