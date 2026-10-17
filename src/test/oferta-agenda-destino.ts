import { prisma } from "@/lib/prisma";

/**
 * Oferta de agenda mínima para uma turma de destino de mudança acadêmica.
 *
 * Desde a confirmação do destino pela agenda (`carregarOfertasAgendaDestinoTx`),
 * uma turma só recebe novo vínculo quando possui grade aprovada no calendário
 * vigente e ao menos uma aula regular futura com professor apto. A data manual
 * da turma deixou de bastar. Esta fixture publica exatamente esse mínimo:
 * calendário aprovado (reaproveita o vigente, se houver), grade aprovada e um
 * encontro PREVISTO bem no futuro, para não depender da data de execução.
 * Cada oferta usa um dia distinto, para não criar conflito docente entre destinos.
 */
export async function publicarOfertaAgendaDestino(turmaId: string, dados: {
  preparadorId: string; decisorId: string; professorId: string; chave?: string;
}) {
  const chave = dados.chave ?? turmaId;
  const ordem = await prisma.propostaGradeTurma.count();
  const inicio = new Date(Date.UTC(2099, 9, 1 + ordem, 12));
  const vigente = await prisma.versaoCalendarioEscolar.findFirst({
    where: { decisao: { aprovada: true } }, orderBy: [{ versao: "desc" }, { id: "desc" }], select: { id: true },
  });
  const calendarioId = vigente?.id ?? (await prisma.versaoCalendarioEscolar.create({ data: {
    versao: ((await prisma.versaoCalendarioEscolar.aggregate({ _max: { versao: true } }))._max.versao ?? 0) + 1,
    preparadorId: dados.preparadorId, fusoInstitucional: "UTC", periodos: [],
    motivo: "Calendário vigente da fixture de oferta de destino.", chaveIdempotencia: `calendario-oferta-${chave}`, entradaHash: "fixture",
    decisao: { create: { decisorId: dados.decisorId, aprovada: true, motivo: "Calendário da fixture conferido." } },
  } })).id;
  const grade = await prisma.propostaGradeTurma.create({ data: {
    turmaId, calendarioId, preparadorId: dados.preparadorId, versao: 1, fusoOrigem: "UTC",
    motivo: "Grade publicada para a turma de destino da fixture.", chaveIdempotencia: `grade-oferta-${chave}`, entradaHash: "fixture", snapshot: {},
  } });
  await prisma.decisaoGradeTurma.create({ data: { propostaId: grade.id, decisorId: dados.decisorId, aprovada: true, motivo: "Grade da fixture conferida." } });
  await prisma.encontroAgenda.create({ data: {
    turmaId, propostaGradeId: grade.id, professorId: dados.professorId, preparadorId: dados.preparadorId,
    inicio, fim: new Date(inicio.getTime() + 60 * 60_000), fusoOrigem: "UTC", status: "PREVISTO",
    motivo: "Aula futura da oferta de destino da fixture.", chaveIdempotencia: `encontro-oferta-${chave}`, entradaHash: "fixture",
  } });
  return { calendarioId, gradeId: grade.id };
}

/**
 * Retira a aula futura desta fixture antes de fechar o nível. Ela existe só para
 * habilitar a turma como destino. A apuração do nível trata aula PREVISTA futura
 * de um vínculo como ENCONTROS_A_REALIZAR, e aula de turma do nível fora do
 * vínculo do aluno (a turma intermediária que ele deixou) como
 * AULA_FORA_DE_VINCULO_CONFERIDO. O fechamento dos cenários pressupõe o nível
 * concluído e sem essas aulas, como antes de o destino exigir agenda.
 */
export async function retirarAulaFuturaDaOferta(...turmaIds: string[]) {
  for (const turmaId of turmaIds) {
    const { count } = await prisma.encontroAgenda.deleteMany({
      where: { turmaId, status: "PREVISTO", diario: null, chaveIdempotencia: { startsWith: "encontro-oferta-" } },
    });
    if (count > 1) throw new Error(`Oferta de destino com mais de uma aula futura da fixture (${count}).`);
  }
}
