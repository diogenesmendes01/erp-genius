import { randomUUID } from "node:crypto";
import { MotivoPendenciaAvisoAgenda, type Prisma } from "@prisma/client";

export const motivosPendenciaAvisoAgenda = [
  MotivoPendenciaAvisoAgenda.SEM_DESTINATARIO_AUTORIZADO,
  MotivoPendenciaAvisoAgenda.CONFIGURACAO_INDISPONIVEL,
  MotivoPendenciaAvisoAgenda.CONTATO_SEM_OPT_IN,
  MotivoPendenciaAvisoAgenda.CONTATO_INDISPONIVEL,
] as const;

type EntradaPendencia = { eventoId: string; matriculaId: string; motivo: MotivoPendenciaAvisoAgenda };

/** Registra uma falha operacional visível sem criar intenção, tentativa ou transporte. */
export async function registrarPendenciaAvisoAgendaTx(tx: Prisma.TransactionClient, entrada: EntradaPendencia) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${entrada.eventoId}:${entrada.matriculaId}:${entrada.motivo}`}, 0))`;
  const existente = await tx.pendenciaAvisoAgenda.findFirst({
    where: { eventoId: entrada.eventoId, matriculaId: entrada.matriculaId, motivo: entrada.motivo, situacao: "PENDENTE" },
    select: { id: true },
  });
  if (existente) return { id: existente.id, criada: false };
  const criada = await tx.pendenciaAvisoAgenda.create({ data: { id: randomUUID(), ...entrada }, select: { id: true } });
  return { id: criada.id, criada: true };
}

/** Só o fluxo que confirmou a condição corrigida deve encerrar a pendência; não reabre transporte. */
export async function resolverPendenciaAvisoAgendaTx(tx: Prisma.TransactionClient, entrada: { id: string; resolvidaPorId: string; observacaoResolucao: string }) {
  const autor = await tx.usuario.findFirst({ where: { id: entrada.resolvidaPorId, ativo: true, papeis: { hasSome: ["ADMINISTRADOR", "SECRETARIA_ACADEMICA"] } }, select: { id: true } });
  if (!autor) throw new Error("Resolutor sem papel atual.");
  const observacao = entrada.observacaoResolucao.trim();
  if (observacao.length < 5 || observacao.length > 2_000) throw new Error("Observação de resolução inválida.");
  const atual = await tx.pendenciaAvisoAgenda.findUnique({ where: { id: entrada.id }, select: { situacao: true, resolvidaPorId: true, observacaoResolucao: true } });
  if (!atual) return false;
  if (atual.situacao === "RESOLVIDA") return atual.resolvidaPorId === entrada.resolvidaPorId && atual.observacaoResolucao === observacao;
  await tx.pendenciaAvisoAgenda.update({ where: { id: entrada.id }, data: { situacao: "RESOLVIDA", resolvidaEm: new Date(), resolvidaPorId: entrada.resolvidaPorId, observacaoResolucao: observacao } });
  return true;
}