"use server";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { contextoConclusaoTx } from "./conclusao-contexto";
import { exigirAcessoRegularizacaoAulaTx } from "./regularizacao-acesso";

export async function solicitarConclusaoSemGravacao(input: { encontroId: string; motivo: string; chaveIdempotencia: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ encontroId: z.string().min(1), motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict().parse(input);
    const hash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const acesso = await exigirAcessoRegularizacaoAulaTx(tx, { atorId: autor.id, encontroId: d.encontroId });
      const anterior = await tx.excecaoGravacaoEncontro.findUnique({ where: { solicitanteId_chaveIdempotencia: { solicitanteId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (anterior) {
        if (anterior.entradaHash !== hash) throw new ErroRegra("Chave utilizada para outra solicitação.");
        return { id: anterior.id };
      }
      const snapshot = await contextoConclusaoTx(tx, d.encontroId);
      const p = await tx.excecaoGravacaoEncontro.create({ data: { ...d, solicitanteId: autor.id, entradaHash: hash, snapshot } });
      await registrarEvento(tx, { tipo: "ConclusaoSemGravacaoSolicitada", agregadoTipo: "EncontroAgenda", agregadoId: d.encontroId, autorId: autor.id, payload: { excecaoId: p.id, motivo: d.motivo, designacaoId: acesso.designacaoId } });
      return { id: p.id };
    });
  });
}

export async function decidirConclusaoSemGravacao(input: { excecaoId: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ excecaoId: z.string().min(1), aprovar: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some((p) => ["GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p))) throw new ErroPermissao();
      const p = await tx.excecaoGravacaoEncontro.findUnique({ where: { id: d.excecaoId }, include: { decisao: true } });
      if (!p) throw new ErroRegra("Solicitação não encontrada.");
      if (p.solicitanteId === autor.id) throw new ErroRegra("Outra pessoa deve decidir a exceção.");
      if (p.decisao) {
        if (p.decisao.decisorId === autor.id && p.decisao.aprovada === d.aprovar && p.decisao.motivo === d.motivo) return { id: p.decisao.id, concluida: p.decisao.aprovada };
        throw new ErroRegra("A solicitação já possui decisão.");
      }
      if (d.aprovar) {
        const atual = await contextoConclusaoTx(tx, p.encontroId);
        if (!isDeepStrictEqual(atual, p.snapshot)) throw new ErroRegra("O encontro ou diário mudou. Prepare uma nova solicitação para conferência.");
        await tx.encontroAgenda.update({ where: { id: p.encontroId }, data: { status: "MINISTRADO" } });
      }
      const decisao = await tx.decisaoExcecaoGravacao.create({ data: { excecaoId: p.id, decisorId: autor.id, aprovada: d.aprovar, motivo: d.motivo } });
      await registrarEvento(tx, { tipo: "ConclusaoSemGravacaoDecidida", agregadoTipo: "EncontroAgenda", agregadoId: p.encontroId, autorId: autor.id, payload: { excecaoId: p.id, aprovada: d.aprovar, motivo: d.motivo } });
      return { id: decisao.id, concluida: decisao.aprovada };
    });
  });
}
