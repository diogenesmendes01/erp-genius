"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { janelaDaPagina, PAGINA_MAXIMA, recorteDaPagina } from "@/lib/pagina-url";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { conferirGestorAvaliacao } from "./regras-tx";
import { identificarMatriculaAvaliacao } from "./identificacao";

/** Histórico paginado por número (E4), em ordem de id: ida e volta trazem as mesmas autorizações. */
export async function consultarHistoricoPreparacaoRecuperacao(input: { alocacaoId: string; pagina?: number }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ alocacaoId: z.string().min(1).max(100), pagina: z.number().int().min(1).max(PAGINA_MAXIMA).default(1) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await conferirGestorAvaliacao(tx, u.id);
      const alocacao = await tx.alocacaoTurma.findUnique({ where: { id: d.alocacaoId }, select: { id: true, matriculaId: true, turmaId: true } });
      if (!alocacao?.matriculaId) throw new ErroRegra("Vínculo acadêmico não encontrado.");
      const lidos = await tx.autorizacaoEspecialPreparacaoRecuperacao.findMany({
        where: { alocacaoId: alocacao.id }, orderBy: { id: "asc" }, ...janelaDaPagina(d.pagina, 20),
        select: { id: true, motivo: true, criadaEm: true, prazoAte: true, autorizador: { select: { nome: true } }, _count: { select: { propostasPlano: true } } },
      });
      const { registros, temProxima } = recorteDaPagina(lidos, 20);
      return { alocacaoId: alocacao.id, identificacao: await identificarMatriculaAvaliacao(tx, alocacao.matriculaId, alocacao.turmaId),
        pagina: d.pagina, temProxima,
        historico: registros.map(a => ({ id: a.id, motivo: a.motivo, criadaEm: a.criadaEm.toISOString(), prazoAte: a.prazoAte.toISOString(),
          autorizador: a.autorizador, quantidadePropostas: a._count.propostasPlano })) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
