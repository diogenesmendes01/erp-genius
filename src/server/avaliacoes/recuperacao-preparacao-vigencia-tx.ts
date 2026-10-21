import { isDeepStrictEqual } from "node:util";
import { Papel, Prisma } from "@prisma/client";

/** Uso interno após bloquear o vínculo; não substitui aprovação ou execução. */
export async function preparacaoRecuperacaoVigenteTx(tx: Prisma.TransactionClient, propostaId: string, instante = new Date(), autorizacaoId?: string) {
  const p = await tx.propostaPlanoRecuperacao.findUnique({ where: { id: propostaId }, include: {
    matricula: true, alocacao: { include: { turma: true } }, autorizacaoPreparacao: { include: { autorizador: { select: { ativo: true, papeis: true } } } },
  } });
  if (!p || (autorizacaoId && p.autorizacaoPreparacaoId && autorizacaoId !== p.autorizacaoPreparacaoId)) return false;
  const a = autorizacaoId ? await tx.autorizacaoEspecialPreparacaoRecuperacao.findUnique({ where: { id: autorizacaoId }, include: { autorizador: { select: { ativo: true, papeis: true } } } }) : p.autorizacaoPreparacao;
  if (!a) return false;
  const agora = new Date();
  if (!Number.isFinite(instante.getTime()) || a.alocacaoId !== p.alocacaoId || a.criadaEm > instante || a.prazoAte < instante ||
    a.criadaEm > agora || a.prazoAte < agora || !a.autorizador.ativo || !a.autorizador.papeis.some(papel => papel === Papel.GERENTE_PEDAGOGICO || papel === Papel.ADMINISTRADOR) ||
    !["PAUSADA", "ENCERRADA"].includes(p.matricula.status) || p.alocacao.matriculaId !== p.matriculaId ||
    p.alocacao.turma.nivelId !== p.nivelId || p.alocacao.turma.regraAvaliacaoId !== p.regraId) return false;
  return isDeepStrictEqual(a.snapshot, { matriculaId: p.matriculaId, alocacaoId: p.alocacaoId, turmaId: p.alocacao.turmaId,
    nivelId: p.nivelId, regraId: p.regraId, statusMatricula: p.matricula.status });
}
