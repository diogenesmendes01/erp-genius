import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared/evento";
import { executarAcao, type Resultado } from "@/server/_shared/resultado";
import { ErroRegra, exigirSessao, type UsuarioSessao } from "@/server/_shared/sessao";

export type NotificacaoItem = { id: string; titulo: string; refId: string; criadaEm: Date; lida: boolean };

/** As 20 últimas notificações do próprio usuário, da mais recente para a mais antiga. */
export async function listarNotificacoes(usuario: UsuarioSessao): Promise<NotificacaoItem[]> {
  if (!usuario?.id) return [];
  const linhas = await prisma.notificacaoUsuario.findMany({
    where: { usuarioId: usuario.id },
    orderBy: [{ criadaEm: "desc" }, { id: "desc" }],
    take: 20,
    select: { id: true, titulo: true, refId: true, criadaEm: true, lidaEm: true },
  });
  return linhas.map((n) => ({ id: n.id, titulo: n.titulo, refId: n.refId, criadaEm: n.criadaEm, lida: n.lidaEm !== null }));
}

/** Marca como lida uma notificação do próprio usuário (idempotente). */
export async function marcarNotificacaoLida(id: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    await prisma.$transaction(async (tx) => {
      const n = await tx.notificacaoUsuario.findFirst({ where: { id, usuarioId: autor.id }, select: { id: true, refId: true, lidaEm: true } });
      if (!n) throw new ErroRegra("Notificação não encontrada.");
      if (n.lidaEm) return;
      const r = await tx.notificacaoUsuario.updateMany({ where: { id, lidaEm: null }, data: { lidaEm: new Date() } });
      if (r.count === 0) return;
      await registrarEvento(tx, { tipo: "NotificacaoLida", agregadoTipo: "Tarefa", agregadoId: n.refId, autorId: autor.id, payload: { notificacaoId: n.id } });
    });
    revalidatePath("/inicio");
  });
}
