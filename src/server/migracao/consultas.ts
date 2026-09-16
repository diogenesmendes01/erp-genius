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
        select: { id: true, origem: true, chaveLote: true, estado: true, criadoEm: true, preparadoPor: { select: { nome: true } }, _count: { select: { linhas: true, conflitosEntrada: true } }, linhas: { select: { _count: { select: { pendencias: true } }, colisoesComoConflitante: { select: { id: true } }, colisoesComoExistente: { select: { id: true } } } } },
      });
      const pagina = lotes.slice(0, 20).map((lote) => ({ id: lote.id, origem: lote.origem, chaveLote: lote.chaveLote, estado: lote.estado, criadoEm: lote.criadoEm, preparadoPorNome: lote.preparadoPor.nome, linhas: lote._count.linhas, pendencias: lote.linhas.reduce((total, linha) => total + linha._count.pendencias, 0), colisoes: new Set(lote.linhas.flatMap((linha) => [...linha.colisoesComoConflitante, ...linha.colisoesComoExistente].map((colisao) => colisao.id))).size, conflitosEntrada: lote._count.conflitosEntrada }));
      return { itens: pagina, proximoCursor: lotes.length > 20 ? pagina.at(-1)!.id : null } satisfies ConsultaLotesPreparacaoMigracao;
    });
  });
}

export async function consultarLotePreparacaoMigracao(loteId: string) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    return prisma.$transaction(async (tx) => {
      await adminFrescoTx(tx, sessao.id);
      const id = z.string().min(1).max(100).parse(loteId);
      const lote = await tx.lotePreparacaoMigracao.findUnique({ where: { id }, select: { id: true, origem: true, chaveLote: true, estado: true, criadoEm: true, preparadoPor: { select: { nome: true } }, conflitosEntrada: { orderBy: { criadoEm: "asc" }, select: { linhaOrigem: true, codigo: true, entradaHash: true, dadosConflitantes: true, criadoEm: true } }, linhas: { orderBy: { linhaOrigem: "asc" }, select: { id: true, linhaOrigem: true, alunoOrigemId: true, turmaOrigemId: true, matriculaOrigemId: true, financeiroOrigemId: true, dadosOrigem: true, entradaHash: true, estado: true, pendencias: { orderBy: [{ campo: "asc" }, { codigo: "asc" }], select: { campo: true, codigo: true, detalhe: true } }, colisoesComoConflitante: { select: { id: true, tipo: true, identificadorOrigem: true, linhaExistente: { select: { linhaOrigem: true } } } }, colisoesComoExistente: { select: { id: true, tipo: true, identificadorOrigem: true, linhaConflitante: { select: { linhaOrigem: true } } } } } } } });
      if (!lote) return null;
      const eventos = await tx.evento.findMany({ where: { agregadoTipo: "LotePreparacaoMigracao", agregadoId: id, tipo: "ConflitoPreparacaoMigracaoRegistrado" }, select: { criadoEm: true, autor: { select: { nome: true } }, payload: true } });
      const autorPorHash = new Map<string, { nome: string | null; criadoEm: Date }>();
      for (const evento of eventos) {
        const conflitos = (evento.payload as { conflitos?: unknown } | null)?.conflitos;
        if (!Array.isArray(conflitos)) continue;
        for (const conflito of conflitos) if (conflito && typeof conflito === "object" && typeof (conflito as { entradaHash?: unknown }).entradaHash === "string") autorPorHash.set((conflito as { entradaHash: string }).entradaHash, { nome: evento.autor?.nome ?? null, criadoEm: evento.criadoEm });
      }
      return { ...lote, conflitosEntrada: lote.conflitosEntrada.map((conflito) => ({ ...conflito, registradoPorNome: autorPorHash.get(conflito.entradaHash)?.nome ?? null, registradoEm: autorPorHash.get(conflito.entradaHash)?.criadoEm ?? conflito.criadoEm })), linhas: lote.linhas.map((linha) => {
        const colisoes = new Map<string, { tipo: string; identificadorOrigem: string; outraLinhaOrigem: string }>();
        for (const colisao of linha.colisoesComoConflitante) colisoes.set(colisao.id, { tipo: colisao.tipo, identificadorOrigem: colisao.identificadorOrigem, outraLinhaOrigem: colisao.linhaExistente.linhaOrigem });
        for (const colisao of linha.colisoesComoExistente) colisoes.set(colisao.id, { tipo: colisao.tipo, identificadorOrigem: colisao.identificadorOrigem, outraLinhaOrigem: colisao.linhaConflitante.linhaOrigem });
        return { ...linha, colisoes: [...colisoes.values()] };
      }) };
    });
  });
}
