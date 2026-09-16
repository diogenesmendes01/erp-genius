"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, executarAcao, exigirSessaoComPapel } from "@/server/_shared";

const Entrada = z.object({ cursor: z.string().min(1).max(100).optional() }).strict();
export type ItemLotePreparacaoMigracao = { id: string; origem: string; chaveLote: string; estado: "PREPARADO" | "COM_PENDENCIAS"; criadoEm: Date; preparadoPorNome: string; linhas: number; pendencias: number; colisoes: number; conflitosEntrada: number };
export type ConsultaLotesPreparacaoMigracao = { itens: ItemLotePreparacaoMigracao[]; proximoCursor: string | null };

async function adminFrescoTx(tx: Prisma.TransactionClient, usuarioId: string) {
  const [usuario] = await tx.$queryRaw<{ ativo: boolean; papeis: Papel[] }[]>(Prisma.sql`SELECT ativo, papeis FROM "Usuario" WHERE id = ${usuarioId} FOR SHARE`);
  if (!usuario?.ativo || !usuario.papeis.includes(Papel.ADMINISTRADOR)) throw new ErroPermissao("Sua permissão mudou; inicie a consulta novamente.");
}

/** Consulta administrativa sem aplicar nem supor dados a partir da preparação. */
export async function consultarLotesPreparacaoMigracao(input: { cursor?: string } = {}) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = Entrada.parse(input);
    return prisma.$transaction(async (tx) => {
      await adminFrescoTx(tx, sessao.id);
      const lotes = await tx.lotePreparacaoMigracao.findMany({
        ...(dados.cursor ? { where: { id: { gt: dados.cursor } } } : {}), orderBy: { id: "asc" }, take: 21,
        select: { id: true, origem: true, chaveLote: true, estado: true, criadoEm: true, preparadoPor: { select: { nome: true } }, _count: { select: { linhas: true, conflitosEntrada: true } }, linhas: { select: { _count: { select: { pendencias: true, colisoesComoConflitante: true } } } } },
      });
      const pagina = lotes.slice(0, 20).map((lote) => ({ id: lote.id, origem: lote.origem, chaveLote: lote.chaveLote, estado: lote.estado, criadoEm: lote.criadoEm, preparadoPorNome: lote.preparadoPor.nome, linhas: lote._count.linhas, pendencias: lote.linhas.reduce((total, linha) => total + linha._count.pendencias, 0), colisoes: lote.linhas.reduce((total, linha) => total + linha._count.colisoesComoConflitante, 0), conflitosEntrada: lote._count.conflitosEntrada }));
      return { itens: pagina, proximoCursor: lotes.length > 20 ? pagina.at(-1)!.id : null } satisfies ConsultaLotesPreparacaoMigracao;
    });
  });
}

export async function consultarLotePreparacaoMigracao(loteId: string) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    return prisma.$transaction(async (tx) => {
      await adminFrescoTx(tx, sessao.id);
      return tx.lotePreparacaoMigracao.findUnique({ where: { id: z.string().min(1).max(100).parse(loteId) }, select: { id: true, origem: true, chaveLote: true, estado: true, criadoEm: true, conflitosEntrada: { orderBy: { criadoEm: "asc" }, select: { linhaOrigem: true, codigo: true, criadoEm: true } }, linhas: { orderBy: { linhaOrigem: "asc" }, select: { id: true, linhaOrigem: true, alunoOrigemId: true, turmaOrigemId: true, matriculaOrigemId: true, financeiroOrigemId: true, estado: true, pendencias: { orderBy: [{ campo: "asc" }, { codigo: "asc" }], select: { campo: true, codigo: true, detalhe: true } }, colisoesComoConflitante: { select: { tipo: true, identificadorOrigem: true, linhaExistente: { select: { linhaOrigem: true } } } } } } } });
    });
  });
}
