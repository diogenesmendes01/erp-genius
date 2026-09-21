"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { conferirGestorAvaliacao } from "./regras-tx";
import { identificarMatriculaAvaliacao } from "./identificacao";

export async function consultarHistoricoPreparacaoRecuperacao(input: { alocacaoId: string; depoisId?: string }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ alocacaoId: z.string().min(1).max(100), depoisId: z.string().min(1).max(100).optional() }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await conferirGestorAvaliacao(tx, u.id);
      const alocacao = await tx.alocacaoTurma.findUnique({ where: { id: d.alocacaoId }, select: { id: true, matriculaId: true, turmaId: true } });
      if (!alocacao?.matriculaId) throw new ErroRegra("Vínculo acadêmico não encontrado.");
      const registros = await tx.autorizacaoEspecialPreparacaoRecuperacao.findMany({
        where: { alocacaoId: alocacao.id, ...(d.depoisId ? { id: { gt: d.depoisId } } : {}) }, orderBy: { id: "asc" }, take: 21,
        select: { id: true, motivo: true, criadaEm: true, prazoAte: true, autorizador: { select: { nome: true } }, _count: { select: { propostasPlano: true } } },
      });
      return { alocacaoId: alocacao.id, identificacao: await identificarMatriculaAvaliacao(tx, alocacao.matriculaId, alocacao.turmaId),
        proximoId: registros.length > 20 ? registros[19].id : null,
        historico: registros.slice(0, 20).map(a => ({ id: a.id, motivo: a.motivo, criadaEm: a.criadaEm.toISOString(), prazoAte: a.prazoAte.toISOString(),
          autorizador: a.autorizador, quantidadePropostas: a._count.propostasPlano })) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
