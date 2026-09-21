"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { conferirGestorAvaliacao } from "./regras-tx";
import { identificarMatriculaAvaliacao } from "./identificacao";

export async function consultarAutorizacoesEspeciaisRecuperacao(input: { itemReservaId: string; depoisId?: string }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ itemReservaId: z.string().min(1).max(100), depoisId: z.string().min(1).max(100).optional() }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await conferirGestorAvaliacao(tx, u.id);
      const item = await tx.itemReservaTentativaRecuperacao.findUnique({ where: { id: d.itemReservaId }, include: {
        realizacao: true, reserva: { include: { cancelamento: true, proposta: { include: { decisao: true, disponibilizacao: true, matricula: true, alocacao: { include: { turma: true } } } } } },
      } });
      if (!item) throw new ErroRegra("Pendência de recuperação não encontrada.");
      const p = item.reserva.proposta;
      const cursor = d.depoisId ? await tx.autorizacaoEspecialRecuperacao.findFirst({ where: { id: d.depoisId, itemReservaId: item.id }, select: { id: true, criadaEm: true } }) : null;
      if (d.depoisId && !cursor) throw new ErroRegra("Cursor de autorizações não encontrado para esta tentativa.");
      const historico = await tx.autorizacaoEspecialRecuperacao.findMany({ where: { itemReservaId: item.id, ...(cursor ? { OR: [{ criadaEm: { lt: cursor.criadaEm } }, { criadaEm: cursor.criadaEm, id: { lt: cursor.id } }] } : {}) }, orderBy: [{ criadaEm: "desc" }, { id: "desc" }], take: 21,
        select: { id: true, motivo: true, prazoAte: true, criadaEm: true, autorizador: { select: { nome: true } } } });
      const podeAutorizar = !item.realizacao && !item.reserva.cancelamento && !!p.decisao?.aprovada && !!p.disponibilizacao &&
        ["PAUSADA", "ENCERRADA"].includes(p.matricula.status) && p.alocacao.matriculaId === p.matriculaId &&
        p.alocacao.turma.regraAvaliacaoId === p.regraId && p.alocacao.turma.nivelId === p.nivelId;
      return { itemReservaId: item.id, habilidade: item.habilidade, statusMatricula: p.matricula.status, podeAutorizar,
        identificacao: await identificarMatriculaAvaliacao(tx, p.matriculaId, p.alocacao.turmaId),
        proximoId: historico.length > 20 ? historico[19].id : null,
        historico: historico.slice(0, 20).map(a => ({ ...a, criadaEm: a.criadaEm.toISOString(), prazoAte: a.prazoAte.toISOString() })) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
