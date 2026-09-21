import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { aplicarFinanceiroEncerramentoTx } from "./encerramento-aplicar-financeiro";
import { aplicarEstadoEncerramentoTx } from "./encerramento-aplicar-estado";

const Resultado = z.object({ matriculaIds: z.array(z.string()), ajustes: z.array(z.string()), creditos: z.array(z.string()), multas: z.array(z.string()), liquidacoesHoras: z.array(z.string()), compensacoes: z.array(z.string()), registrosTemporais: z.array(z.string()) });

/** Executor interno. O transporte público deve autenticar e abrir a transação; nunca aceitar o relógio do cliente. */
export async function efetivarAcertoEncerramentoTx(tx: Prisma.TransactionClient, d: { alunoId: string; decisaoId: string; executorId: string }, agora: Date) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const decisao = await tx.decisaoAcertoEncerramento.findFirst({ where: { id: d.decisaoId, rascunho: { solicitacao: { alunoId: d.alunoId } } }, select: { rascunho: { select: { solicitacaoId: true } } } });
  if (!decisao) throw new ErroRegra("Acerto não encontrado para este aluno.");
  const solicitacaoId = decisao.rascunho.solicitacaoId;
  await tx.$queryRaw`SELECT id FROM "SolicitacaoEncerramentoMatriculas" WHERE id=${solicitacaoId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${d.executorId} FOR SHARE`;
  const u = await tx.usuario.findUnique({ where: { id: d.executorId }, select: { ativo: true, papeis: true } });
  if (!u?.ativo || !u.papeis.some(p => p === "FINANCEIRO" || p === "ADMINISTRADOR")) throw new ErroPermissao();
  const anterior = await tx.efetivacaoAcertoEncerramento.findUnique({ where: { solicitacaoId } });
  if (anterior) {
    if (anterior.decisaoId !== d.decisaoId) throw new ErroRegra("Pedido efetivado por outra decisão.");
    return { id: anterior.id, solicitacaoId, decisaoId: anterior.decisaoId, ...Resultado.parse(anterior.resultado), efetivado: true as const };
  }
  const financeiro = await aplicarFinanceiroEncerramentoTx(tx, d, agora);
  const registros = await aplicarEstadoEncerramentoTx(tx, financeiro.acerto, agora);
  const resultado = { matriculaIds: financeiro.acerto.matriculaIds, ajustes: financeiro.ajustes, creditos: financeiro.creditos.map(c => c.id), multas: financeiro.multas,
    liquidacoesHoras: financeiro.liquidacoesHoras, compensacoes: financeiro.compensacoes, registrosTemporais: registros.map(r => r.id) };
  const aplicacao = await tx.efetivacaoAcertoEncerramento.create({ data: { solicitacaoId, decisaoId: d.decisaoId, executorId: d.executorId, aplicadaEm: agora, resultado } });
  await registrarEvento(tx, { tipo: "AcertoEncerramentoEfetivado", agregadoTipo: "Aluno", agregadoId: d.alunoId, autorId: d.executorId,
    payload: { efetivacaoId: aplicacao.id, solicitacaoId, decisaoId: d.decisaoId, matriculaIds: resultado.matriculaIds } });
  await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
  return { id: aplicacao.id, solicitacaoId, decisaoId: d.decisaoId, ...resultado, efetivado: true as const };
}
