import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared/evento";
import { executarAcao, type Resultado } from "@/server/_shared/resultado";
import { ErroRegra, exigirSessao } from "@/server/_shared/sessao";
import { exigirCapacidadeCrm } from "./permissoes";
import { escopoTarefas } from "./tarefas";

type TarefaReclamada = { id: string; responsavelId: string; titulo: string };

/**
 * Dispara os lembretes vencidos. O claim é um UPDATE atômico (`lembreteDisparadoEm` nulo -> now()):
 * duas execuções simultâneas nunca reclamam a mesma tarefa, então há uma única notificação por lembrete.
 * Claim e notificações ficam na mesma transação: se a criação falhar, o claim volta e o próximo tick repete.
 */
export async function rodarLembretesTarefas(agora: Date): Promise<{ notificadas: number }> {
  return prisma.$transaction(async (tx) => {
    const reclamadas = await tx.$queryRaw<TarefaReclamada[]>`
      UPDATE "Tarefa" SET "lembreteDisparadoEm" = now()
      WHERE status = 'ABERTA' AND "responsavelId" IS NOT NULL
        AND "lembrarEm" <= ${agora} AND "lembreteDisparadoEm" IS NULL
      RETURNING id, "responsavelId", titulo`;
    for (const t of reclamadas) {
      await tx.notificacaoUsuario.create({
        data: { usuarioId: t.responsavelId, tipo: "LEMBRETE_TAREFA", refTipo: "Tarefa", refId: t.id, titulo: t.titulo },
      });
      await registrarEvento(tx, {
        tipo: "LembreteDisparado", agregadoTipo: "Tarefa", agregadoId: t.id, autorId: null,
        payload: { usuarioId: t.responsavelId },
      });
    }
    return { notificadas: reclamadas.length };
  });
}

/** Adia o lembrete: `lembrarEm = agora + minutos` e reabre o disparo. Só tarefa aberta e visível ao usuário. */
export async function adiarLembrete(tarefaId: string, minutos: 10 | 60): Promise<Resultado> {
  return executarAcao(async () => {
    if (minutos !== 10 && minutos !== 60) throw new ErroRegra("Escolha 10 minutos ou 1 hora.");
    const autor = await exigirSessao();
    exigirCapacidadeCrm(autor, "tarefas.ver");
    await prisma.$transaction(async (tx) => {
      const t = await tx.tarefa.findFirst({
        where: { AND: [{ id: tarefaId }, await escopoTarefas(autor, false)] },
        select: { id: true, status: true, lembrarEm: true },
      });
      if (!t) throw new ErroRegra("Tarefa não encontrada.");
      if (t.status !== "ABERTA") throw new ErroRegra("Só tarefas abertas podem ter o lembrete adiado.");
      const lembrarEm = new Date(Date.now() + minutos * 60000);
      await tx.tarefa.update({ where: { id: t.id }, data: { lembrarEm, lembreteDisparadoEm: null, versao: { increment: 1 } } });
      await registrarEvento(tx, {
        tipo: "LembreteAdiado", agregadoTipo: "Tarefa", agregadoId: t.id, autorId: autor.id,
        payload: { minutos, de: t.lembrarEm?.toISOString() ?? null, para: lembrarEm.toISOString() },
      });
    });
    revalidatePath("/tarefas");
    revalidatePath("/inicio");
  });
}
