import { Prisma } from "@prisma/client";

// Chamador deve conferir usuário ativo/papel docente e bloquear o vínculo.
// Uma designação antiga nunca prevalece sobre troca ou revogação posterior.
export async function avaliacoesDesignadas(tx: Prisma.TransactionClient, alocacaoId: string, professorId: string) {
  const registros = await tx.registroAvaliacaoMatricula.findMany({
    where: { alocacaoId, designacoes: { some: { professorId } }, versoes: { none: { decisao: { aprovada: true } } } },
    select: { id: true, codigoAvaliacao: true, designacoes: { orderBy: { versao: "desc" }, take: 1, select: { professorId: true } } },
  });
  return registros.filter(r => r.designacoes[0]?.professorId === professorId).map(r => ({ id: r.id, codigoAvaliacao: r.codigoAvaliacao }));
}
