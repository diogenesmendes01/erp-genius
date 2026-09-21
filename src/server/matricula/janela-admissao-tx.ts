import type { Prisma } from "@prisma/client";

/** A última aprovação vale; propostas pendentes/rejeitadas não substituem sua regra. */
export async function carregarJanelaAdmissaoVigente(tx: Prisma.TransactionClient, turmaId: string) {
  const r = await tx.janelaAdmissaoTurma.findFirst({ where: { turmaId, decisao: { aprovada: true } }, orderBy: { versao: "desc" },
    select: { id: true, versao: true, limiteEntrada: true, fusoAdmissao: true } });
  return r ? { ...r, limiteEntrada: r.limiteEntrada.toISOString().slice(0, 10) } : null;
}
