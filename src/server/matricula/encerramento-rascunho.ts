"use server";
import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { PreviaMensalPedidoEncerramentoSchema } from "./encerramento-previa-schema";
import { carregarPreviaMensalEncerramentoTx } from "./encerramento-previa-tx";

const Preparar = PreviaMensalPedidoEncerramentoSchema.extend({
  chaveIdempotencia: z.string().trim().min(8).max(100),
  motivo: z.string().trim().min(5).max(2000),
  versaoAnterior: z.number().int().nonnegative(),
});

/** Versão de trabalho preservada; não é uma proposta completa autorizada para execução. */
export async function salvarRascunhoAcertoEncerramento(input: z.input<typeof Preparar>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const original = Preparar.parse(input);
    const d = { ...original, contratos: [...original.contratos].sort((a, b) => a.matriculaId.localeCompare(b.matriculaId)).map((c) => ({ ...c, ...(c.outrasCobrancas ? { outrasCobrancas: [...c.outrasCobrancas].sort((a, b) => a.cobrancaId.localeCompare(b.cobrancaId)) } : {}), parcelas: [...c.parcelas].sort((a, b) => a.cobrancaId.localeCompare(b.cobrancaId)) })) };
    const entradaHash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async (tx) => {
      const trava = `rascunho-encerramento:${autor.id}:${d.chaveIdempotencia}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${trava}, 0))`;
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some((p) => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const existente = await tx.rascunhoAcertoEncerramento.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (existente) {
        if (existente.entradaHash !== entradaHash) throw new ErroRegra("Chave já utilizada com outra conferência.");
        return { id: existente.id, versao: existente.versao };
      }
      await tx.$queryRaw`SELECT id FROM "SolicitacaoEncerramentoMatriculas" WHERE id = ${d.solicitacaoId} FOR UPDATE`;
      const pedido = await tx.solicitacaoEncerramentoMatriculas.findFirst({ where: { id: d.solicitacaoId, alunoId: d.alunoId } });
      if (!pedido) throw new ErroRegra("Pedido não encontrado para este aluno.");
      const anterior = await tx.rascunhoAcertoEncerramento.findFirst({ where: { solicitacaoId: pedido.id }, orderBy: { versao: "desc" }, select: { versao: true } });
      if ((anterior?.versao ?? 0) !== d.versaoAnterior) throw new ErroRegra("Outra versão foi preparada. Atualize a conferência antes de salvar.");
      const ids = d.contratos.map((c) => c.matriculaId);
      await bloquearMatriculas(tx, ids);
      await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE "matriculaId" IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
      await tx.$queryRaw`SELECT d.id FROM "Documento" d JOIN "Matricula" m ON m."contratoDocumentoId" = d.id WHERE m.id IN (${Prisma.join(ids)}) ORDER BY d.id FOR SHARE OF d`;
      const entrada = { solicitacaoId: d.solicitacaoId, alunoId: d.alunoId, contratos: d.contratos };
      const snapshot = await carregarPreviaMensalEncerramentoTx(tx, entrada);
      const r = await tx.rascunhoAcertoEncerramento.create({ data: {
        solicitacaoId: pedido.id, preparadorId: autor.id, versao: d.versaoAnterior + 1,
        chaveIdempotencia: d.chaveIdempotencia, entradaHash, entrada, snapshot, motivo: d.motivo,
      } });
      await tx.solicitacaoEncerramentoMatriculas.update({ where: { id: pedido.id }, data: { status: "EM_ACERTO" } });
      await registrarEvento(tx, { tipo: "RascunhoAcertoEncerramentoPreparado", agregadoTipo: "Aluno", agregadoId: d.alunoId, autorId: autor.id,
        payload: { solicitacaoId: pedido.id, rascunhoId: r.id, versao: r.versao, matriculaIds: ids } });
      return { id: r.id, versao: r.versao };
    });
  });
}

export async function consultarRascunhoAcertoEncerramento(input: { alunoId: string; solicitacaoId: string; versao?: number }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const u = await prisma.usuario.findUniqueOrThrow({ where: { id: autor.id }, select: { ativo: true, papeis: true, permissoes: true } });
    if (!u.ativo) throw new ErroPermissao();
    const d = z.object({ alunoId: z.string().min(1), solicitacaoId: z.string().min(1), versao: z.number().int().positive().optional() }).strict().parse(input);
    const r = await prisma.rascunhoAcertoEncerramento.findFirst({ where: { solicitacaoId: d.solicitacaoId, solicitacao: { alunoId: d.alunoId }, ...(d.versao ? { versao: d.versao } : {}) }, orderBy: { versao: "desc" },
      select: { solicitacao: { select: { efetivacao: { select: { id: true, decisaoId: true, aplicadaEm: true, executor: { select: { nome: true } } } } } }, decisao: true, id: true, versao: true, motivo: true, criadoEm: true, entrada: true, snapshot: true, preparador: { select: { id: true, nome: true } } } });
    return r ? { ...r, efetivacao: r.solicitacao.efetivacao ? { ...r.solicitacao.efetivacao, aplicadaEm: r.solicitacao.efetivacao.aplicadaEm.toISOString() } : null, podeEfetivar: !!r.decisao?.aprovada && !r.solicitacao.efetivacao && u.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR), podeDecidir: !r.solicitacao.efetivacao && !r.decisao && r.preparador.id !== autor.id && (u.papeis.includes(Papel.ADMINISTRADOR) || (u.papeis.includes(Papel.FINANCEIRO) && u.permissoes.includes("financeiro.aprovar_acertos"))), decisao: r.decisao ? { ...r.decisao, decididaEm: r.decisao.decididaEm.toISOString() } : null, criadoEm: r.criadoEm.toISOString() } : null;
  });
}
