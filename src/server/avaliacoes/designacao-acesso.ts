import { Prisma } from "@prisma/client";

export async function avaliacoesDesignadas(tx: Prisma.TransactionClient, alocacaoId: string, professorId: string) {
  const registros = await tx.registroAvaliacaoMatricula.findMany({
    where: { alocacaoId, designacoes: { some: { professorId } }, versoes: { none: { decisao: { aprovada: true } } } },
    select: { id: true, codigoAvaliacao: true, designacoes: { orderBy: { versao: "desc" }, take: 1, select: { professorId: true } } },
  });
  return registros.filter(r => r.designacoes[0]?.professorId === professorId).map(r => ({ id: r.id, codigoAvaliacao: r.codigoAvaliacao }));
}
