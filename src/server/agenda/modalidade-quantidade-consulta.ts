"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra } from "@/server/_shared";
import { carregarPreviaQuantidadeAulasTx } from "./modalidade-quantidade-tx";

export async function preverAlteracaoQuantidadeAulasModalidade(input: { modalidadeId: string; quantidadeNova: number }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ modalidadeId: z.string().min(1), quantidadeNova: z.number().int().positive() }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some((p) => ["SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p))) throw new ErroPermissao();
      const previa = await carregarPreviaQuantidadeAulasTx(tx, d);
      const ultima = await tx.propostaQuantidadeAulasModalidade.findFirst({ where: { modalidadeId: d.modalidadeId }, orderBy: { versao: "desc" }, select: { versao: true } });
      return { ...previa, versaoAnterior: ultima?.versao ?? 0 };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20000 });
  });
}

export async function consultarPropostaQuantidadeAulasModalidade(input: { propostaId: string }) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ propostaId: z.string().min(1) }).strict().parse(input);
    const proposta = await prisma.propostaQuantidadeAulasModalidade.findUnique({ where: { id: d.propostaId }, include: { modalidade: true, preparador: { select: { nome: true } }, decisao: { include: { decisor: { select: { nome: true } } } }, aplicacao: true, impactos: { include: { turma: { select: { codigo: true } } }, orderBy: { turmaId: "asc" } } } });
    if (!proposta) throw new ErroRegra("Proposta de quantidade não encontrada.");
    return { ...proposta, criadaEm: proposta.criadaEm.toISOString(), decididaEm: proposta.decisao?.decididaEm.toISOString() ?? null, aplicadaEm: proposta.aplicacao?.aplicadaEm.toISOString() ?? null };
  });
}
