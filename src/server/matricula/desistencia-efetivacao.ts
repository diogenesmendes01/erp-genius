"use server";

import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento, type Resultado } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { conferirEfetivacaoDesistenciaAcertoContratualTx, conferirEfetivacaoDesistenciaPreparacaoTx } from "./desistencia-efetivacao-tx";

const entradaSchema = z.object({
  pedidoId: z.string().trim().min(1).max(100),
  estadoHash: z.string().regex(/^[a-f0-9]{64}$/),
  decisaoFinanceiraId: z.string().trim().min(1).max(100).optional(),
  aplicacaoAcertoDesistenciaContratualId: z.string().trim().min(1).max(100).optional(),
  motivo: z.string().trim().min(10).max(3000),
}).strict();

function hashEntrada(entrada: z.infer<typeof entradaSchema>) {
  return createHash("sha256").update(JSON.stringify(entrada)).digest("hex");
}

async function exigirExecutorAtualTx(tx: Prisma.TransactionClient, usuarioId: string) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuarioId} FOR SHARE`;
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true } });
  if (!usuario?.ativo || !usuario.papeis.some((papel) => papel === Papel.SECRETARIA_ACADEMICA || papel === Papel.ADMINISTRADOR)) throw new ErroPermissao();
}

/** Efetiva exclusivamente a desistência de uma preparação sem avanço formal.
 * A inserção da aplicação aciona o trigger SQL que cancela a matrícula
 * e libera as reservas na mesma transação. */
export async function efetivarPedidoDesistenciaPreparacao(input: z.input<typeof entradaSchema>): Promise<Resultado<{ id: string; matriculaId: string; status: "CANCELADA" }>> {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const dados = entradaSchema.parse(input);
    const entradaHash = hashEntrada(dados);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const referencia = await tx.pedidoDesistenciaPreparacao.findUnique({ where: { id: dados.pedidoId }, select: { matriculaId: true } });
      if (!referencia) throw new ErroRegra("Pedido de desistência não encontrado.");
      await bloquearMatriculas(tx, [referencia.matriculaId]);
      await tx.$queryRaw`SELECT id FROM "ReservaVagaMatricula" WHERE "matriculaId" = ${referencia.matriculaId} ORDER BY id FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "ReservaAgendaParticular" WHERE "matriculaId" = ${referencia.matriculaId} ORDER BY id FOR UPDATE`;
      await exigirExecutorAtualTx(tx, sessao.id);
      const existente = await tx.efetivacaoPedidoDesistenciaPreparacao.findUnique({ where: { pedidoId: dados.pedidoId } });
      if (existente) {
        if (existente.entradaHash !== entradaHash) throw new ErroRegra("Este pedido já foi efetivado com outra confirmação.");
        return { id: existente.id, matriculaId: existente.matriculaId, status: "CANCELADA" as const };
      }
      let decisaoFinanceiraValida = false;
      let aplicacaoContratualValida = false;
      if (dados.decisaoFinanceiraId) {
        const decisao = await tx.decisaoFinanceiraDesistencia.findUnique({ where: { id: dados.decisaoFinanceiraId }, include: { proposta: true } });
        if (!decisao?.aprovada || decisao.proposta.pedidoId !== dados.pedidoId || decisao.proposta.estadoHash !== dados.estadoHash) throw new ErroRegra("A decisão financeira não está aprovada para este pedido.");
        decisaoFinanceiraValida = true;
      }
      if (dados.aplicacaoAcertoDesistenciaContratualId) {
        if (dados.decisaoFinanceiraId) throw new ErroRegra("Escolha um único acerto financeiro para a efetivação.");
        const aplicacaoContratual = await tx.aplicacaoAcertoDesistenciaContratual.findUnique({
          where: { id: dados.aplicacaoAcertoDesistenciaContratualId },
          include: { decisao: { include: { proposta: true } } },
        });
        if (!aplicacaoContratual?.decisao.aprovada
          || aplicacaoContratual.decisao.proposta.pedidoId !== dados.pedidoId
          || aplicacaoContratual.decisao.proposta.estadoHash !== dados.estadoHash) {
          throw new ErroRegra("A aplicação contratual não está aprovada para este pedido.");
        }
        aplicacaoContratualValida = true;
      }
      const estado = aplicacaoContratualValida
        ? await conferirEfetivacaoDesistenciaAcertoContratualTx(
          tx, dados.aplicacaoAcertoDesistenciaContratualId!, dados.pedidoId, dados.estadoHash,
        )
        : await conferirEfetivacaoDesistenciaPreparacaoTx(tx, dados.pedidoId, dados.estadoHash, decisaoFinanceiraValida);
      if (!aplicacaoContratualValida && "conferencia" in estado
        && estado.conferencia.resumo.financeiro.quantidadeCobrancas > 0 && !decisaoFinanceiraValida) {
        throw new ErroRegra("Cobranças exigem decisão financeira aprovada antes da efetivação.");
      }
      const aplicacao = await tx.efetivacaoPedidoDesistenciaPreparacao.create({ data: {
        pedidoId: estado.pedido.id, matriculaId: estado.pedido.matriculaId, executorId: sessao.id,
        motivo: dados.motivo, entradaHash, estadoHash: dados.estadoHash, decisaoFinanceiraId: dados.decisaoFinanceiraId,
        aplicacaoAcertoDesistenciaContratualId: dados.aplicacaoAcertoDesistenciaContratualId,
      } });
      await registrarEvento(tx, { tipo: "PedidoDesistenciaPreparacaoEfetivado", agregadoTipo: "Matricula", agregadoId: aplicacao.matriculaId,
        autorId: sessao.id, payload: { pedidoId: aplicacao.pedidoId, efetivacaoId: aplicacao.id } });
      // Prisma pode não propagar uma rejeição tardia no COMMIT. Forçar a
      // verificação ainda no callback impede confirmar uma aplicação revertida.
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      return { id: aplicacao.id, matriculaId: aplicacao.matriculaId, status: "CANCELADA" as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  });
}
