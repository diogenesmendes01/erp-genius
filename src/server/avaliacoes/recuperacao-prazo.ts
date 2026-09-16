import { Prisma } from "@prisma/client";

export async function prazoRecuperacaoVigente(tx: Prisma.TransactionClient, disponibilizacaoId: string, noInstante?: Date) {
  const ultima = await tx.propostaProrrogacaoRecuperacao.findFirst({ where: { disponibilizacaoId, decisao: { aprovada: true, ...(noInstante ? { criadaEm: { lte: noInstante } } : {}) } }, orderBy: { versao: "desc" }, select: { novoPrazo: true } });
  return ultima?.novoPrazo ?? (await tx.disponibilizacaoPlanoRecuperacao.findUniqueOrThrow({ where: { id: disponibilizacaoId }, select: { prazoAte: true } })).prazoAte;
}
