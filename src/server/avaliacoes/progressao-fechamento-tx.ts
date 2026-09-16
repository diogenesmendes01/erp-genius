import type { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { carregarEstadoFechamentoTx } from "./fechamento-estado-tx";

/** Somente para o fluxo interno de mudança acadêmica, após conferir o ator e
 * bloquear a solicitação. A gestão responsável já está identificada no ato;
 * a Secretaria recebe apenas a referência, nunca as notas do snapshot. */
export async function exigirFechamentoProgressaoTx(tx: Prisma.TransactionClient, entrada: {
  matriculaId: string | null;
  alocacaoId: string;
  gestorResponsavelId: string;
  fechamentoId?: string | null;
  estadoHashAprovado?: string | null;
}) {
  if (!entrada.matriculaId) throw new ErroRegra("A progressão exige matrícula identificada e conferida.");
  const estado = await carregarEstadoFechamentoTx(tx, entrada.gestorResponsavelId, entrada.alocacaoId);
  if (estado.contexto.matriculaId !== entrada.matriculaId) throw new ErroRegra("O fechamento pertence a outra matrícula.");
  const fechamento = await tx.fechamentoAcademico.findFirst({
    where: { matriculaId: entrada.matriculaId, nivelId: estado.contexto.nivelId },
    orderBy: { versao: "desc" }, select: { id: true, alocacaoReferenciaId: true, regraId: true, resultadoSuficiente: true, estadoHash: true },
  });
  if (!fechamento || !fechamento.resultadoSuficiente || !estado.elegibilidade.podeProgredir) {
    throw new ErroRegra("A mudança de nível exige fechamento acadêmico suficiente, com notas, frequência e pendências conferidas.");
  }
  if (fechamento.alocacaoReferenciaId !== entrada.alocacaoId || fechamento.regraId !== estado.contexto.regraId
    || fechamento.estadoHash !== estado.estadoHash) throw new ErroRegra("O fechamento acadêmico precisa de nova conferência antes da progressão.");
  if (entrada.fechamentoId !== undefined && (!entrada.fechamentoId || entrada.fechamentoId !== fechamento.id
    || entrada.estadoHashAprovado !== fechamento.estadoHash)) throw new ErroRegra("O fechamento usado na aprovação mudou. Cancele a solicitação e encaminhe uma nova conferência pedagógica.");
  return { id: fechamento.id, estadoHash: fechamento.estadoHash };
}
