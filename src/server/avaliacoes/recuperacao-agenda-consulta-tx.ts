import type { Prisma } from "@prisma/client";

/** Recebe somente tentativas já autorizadas pelo chamador, sob seus locks de acesso. */
export async function agendasRecuperacaoAutorizadasTx(tx: Prisma.TransactionClient, itensAutorizados: string[], usuarioId: string) {
  const encontros = itensAutorizados.length ? await tx.encontroAgenda.findMany({
    where: { finalidade: "RECUPERACAO", propostaAgendaRecuperacao: { itemReservaId: { in: itensAutorizados }, decisao: { aprovada: true } } },
    select: { id: true, inicio: true, fim: true, fusoOrigem: true, status: true, professorId: true, professor: { select: { nome: true } },
      propostaAgendaRecuperacao: { select: { itemReservaId: true, decisao: { select: { autorizarDiaNaoLetivo: true } } } } },
  }) : [];
  return new Map(encontros.map(e => [e.propostaAgendaRecuperacao!.itemReservaId, {
    id: e.id, inicio: e.inicio.toISOString(), fim: e.fim.toISOString(), fusoOrigem: e.fusoOrigem, status: e.status,
    avaliador: e.professor?.nome ?? "Avaliador não identificado", mesmoAvaliador: e.professorId === usuarioId,
    excecaoDiaNaoLetivo: e.propostaAgendaRecuperacao!.decisao!.autorizarDiaNaoLetivo,
  }]));
}
export type AgendaRecuperacaoConsulta = Awaited<ReturnType<typeof agendasRecuperacaoAutorizadasTx>> extends Map<string, infer V> ? V : never;
