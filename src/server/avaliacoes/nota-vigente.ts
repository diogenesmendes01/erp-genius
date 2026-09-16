import { Prisma } from "@prisma/client";
import { NotasLancamentoSchema } from "./lancamento-schema";
export async function notaVigente(tx: Prisma.TransactionClient, lancamento: { id: string; notas: unknown; conteudoHash: string }) {
  const c = await tx.propostaCorrecaoNota.findFirst({ where: { lancamentoId: lancamento.id, decisao: { aprovada: true } }, orderBy: { versao: "desc" }, select: { id: true, notas: true, entradaHash: true } });
  return { notas: NotasLancamentoSchema.parse(c?.notas ?? lancamento.notas), origemHash: c?.entradaHash ?? lancamento.conteudoHash, correcaoId: c?.id ?? null };
}
