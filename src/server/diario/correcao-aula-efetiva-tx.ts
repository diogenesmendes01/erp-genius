import type { Prisma } from "@prisma/client";
import { validarProjecaoCorrecaoAula } from "./correcao-aula-projecao";
import type { SnapshotCorrecaoAula } from "./correcao-aula-schema";

export type CorrecaoAulaEfetiva = {
  aprovacaoId: string;
  propostaId: string;
  versao: number;
  snapshot: SnapshotCorrecaoAula;
};

/** Leitor interno: o chamador delimita os encontros pelo seu escopo autorizado.
 * Propostas sem aprovação e rejeições nunca substituem o diário original. */
export async function carregarCorrecoesAulaEfetivasTx(tx: Prisma.TransactionClient, encontroIds: string[]) {
  const resultado = new Map<string, CorrecaoAulaEfetiva>();
  if (!encontroIds.length) return resultado;
  const propostas = await tx.propostaCorrecaoAula.findMany({
    where: { encontroId: { in: [...new Set(encontroIds)] }, aprovacao: { isNot: null } },
    orderBy: [{ encontroId: "asc" }, { versao: "desc" }],
    distinct: ["encontroId"],
    select: { id: true, encontroId: true, diarioId: true, versao: true,
      snapshotAnterior: true, snapshotNovo: true, aprovacao: { select: { id: true } } },
  });
  for (const proposta of propostas) {
    const { novo } = validarProjecaoCorrecaoAula(proposta.snapshotAnterior, proposta.snapshotNovo);
    if (novo.encontroId !== proposta.encontroId || novo.diarioId !== proposta.diarioId || !proposta.aprovacao) {
      throw new Error("A correção publicada não corresponde à fonte do diário.");
    }
    resultado.set(proposta.encontroId, { aprovacaoId: proposta.aprovacao.id,
      propostaId: proposta.id, versao: proposta.versao, snapshot: novo });
  }
  return resultado;
}
