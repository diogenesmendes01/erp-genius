import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared/sessao";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";

/** A ordem evita inversão com ativação e recebimentos; o Aluno trava inclusões por FK. */
export async function bloquearCalendarioAluno(tx: Prisma.TransactionClient, alunoId: string) {
  const antes = await tx.matricula.findMany({ where: { alunoId }, select: { id: true }, orderBy: { id: "asc" } });
  const ids = antes.map((m) => m.id);
  await bloquearMatriculas(tx, ids);
  if (ids.length > 0) await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE "matriculaId" IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Aluno" WHERE id = ${alunoId} FOR UPDATE`;
  const depois = await tx.matricula.findMany({ where: { alunoId }, select: { id: true }, orderBy: { id: "asc" } });
  if (JSON.stringify(ids) !== JSON.stringify(depois.map((m) => m.id))) {
    throw new ErroRegra("O conjunto de matrículas mudou. Atualize a ficha e tente novamente.");
  }
}

export async function carregarEstadoRetomada(tx: Pick<Prisma.TransactionClient, "aluno" | "matricula" | "movimentacaoAluno" | "evento">, alunoId: string) {
  const aluno = await tx.aluno.findUnique({ where: { id: alunoId }, select: { id: true, primeiroNome: true, sobrenome: true, status: true } });
  if (!aluno) throw new ErroRegra("Aluno não encontrado.");
  const pausa = await tx.movimentacaoAluno.findFirst({ where: { alunoId, tipo: "PAUSA", matriculaId: null }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], select: { id: true, criadoEm: true, motivo: true } });
  const matriculas = await tx.matricula.findMany({ where: { alunoId }, orderBy: { id: "asc" }, select: {
    id: true, codigo: true, leadId: true, status: true, moeda: true, mesesPlano: true, diaVencimento: true,
    cobrancas: { orderBy: { id: "asc" }, select: {
      id: true, codigo: true, matriculaId: true, versao: true, cicloRegua: true, tipo: true, status: true, valorOriginal: true,
      valorNegociado: true, valorRecebido: true, valorLiquidadoCredito: true, saldo: true, moeda: true, vencimento: true, competencia: true, pagoEm: true, canceladaPorPausaId: true,
    } },
  } });
  const trilha = pausa ? await tx.evento.findFirst({ where: {
    agregadoTipo: "Aluno", agregadoId: alunoId, tipo: "AlunoPausado",
    AND: [{ payload: { path: ["pausaId"], equals: pausa.id } }, { payload: { path: ["protocoloRetomada"], equals: 1 } }],
  }, select: { id: true } }) : null;
  return { aluno, pausa, matriculas, pausaRastreada: !!trilha };
}
