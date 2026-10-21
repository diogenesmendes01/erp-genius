import { Papel, type Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared/sessao";

/** Executar na mesma transação que altera a turma; início é o instante conhecido da atribuição. */
export async function sincronizarVinculoDocente(tx: Prisma.TransactionClient, turmaId: string, professorId: string | null, agora = new Date()) {
  if (professorId) {
    const professor = await tx.usuario.findFirst({ where: { id: professorId, ativo: true, papeis: { has: Papel.PROFESSOR } }, select: { id: true } });
    if (!professor) throw new ErroRegra("Selecione um professor ativo com papel docente.");
  }
  const abertos = await tx.vinculoDocente.findMany({ where: { turmaId, fim: null } });
  if (abertos.length === 1 && abertos[0].professorId === professorId) return;
  if (abertos.length) await tx.vinculoDocente.updateMany({ where: { turmaId, fim: null }, data: { fim: agora } });
  if (professorId) await tx.vinculoDocente.create({ data: { turmaId, professorId, inicio: agora } });
}
