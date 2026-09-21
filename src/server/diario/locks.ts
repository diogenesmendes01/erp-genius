import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";

/** Ordem compartilhada com movimentos acadêmicos: contratos, aluno, turma.
 * Vínculo novo durante a espera exige nova leitura em outra transação, sem inverter locks.
 */
export async function bloquearContextoDiario(tx: Prisma.TransactionClient, turmaId: string, alunoIds: string[]) {
  const lerIds = async () => [...new Set((await tx.alocacaoTurma.findMany({ where: { turmaId }, select: { matriculaId: true } }))
    .flatMap((a) => a.matriculaId ? [a.matriculaId] : []))].sort();
  const ids = await lerIds();
  await bloquearMatriculas(tx, ids);
  if (alunoIds.length) await tx.$queryRaw`SELECT id FROM "Aluno" WHERE id IN (${Prisma.join([...new Set(alunoIds)].sort())}) ORDER BY id FOR KEY SHARE`;
  await tx.$queryRaw`SELECT id FROM "Turma" WHERE id = ${turmaId} FOR UPDATE`;
  if (JSON.stringify(await lerIds()) !== JSON.stringify(ids)) throw new ErroRegra("Os vínculos da turma mudaram durante a conferência. Recarregue a chamada.");
}
