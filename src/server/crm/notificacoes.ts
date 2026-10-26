import type { Db } from "@/server/whatsapp/escopo";
import { lerNotificacoesNaDb } from "./notificacoes-leitura";
import type { TipoNotificacao } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { registrarEvento, type AgregadoTipo } from "@/server/_shared/evento";
import { executarAcao, type Resultado } from "@/server/_shared/resultado";
import { ErroRegra, exigirSessao, type UsuarioSessao } from "@/server/_shared/sessao";

export type NotificacaoItem = { id: string; tipo: TipoNotificacao; titulo: string; refTipo: string; refId: string; criadaEm: Date; lida: boolean };

/** Agregado auditado ao marcar como lida: o do item referenciado (SLA → AtendimentoWhatsApp; lembrete → Tarefa). */
const agregadoDaNotificacao = (refTipo: string): AgregadoTipo => (refTipo === "AtendimentoWhatsApp" ? "AtendimentoWhatsApp" : "Tarefa");

/** As 20 últimas autorizadas. A Db fornecida é usada diretamente; default sem memo global em ReadCommitted. */
export async function listarNotificacoes(usuario: UsuarioSessao, db: Db = prisma): Promise<NotificacaoItem[]> {
  if (!usuario?.id) return [];
  if (db === prisma) return prisma.$transaction(tx => lerNotificacoesNaDb(tx, usuario.id), { isolationLevel: "ReadCommitted", timeout: 5000 });
  return lerNotificacoesNaDb(db, usuario.id);
}
/** Marca como lida uma notificação do próprio usuário (idempotente). */
export async function marcarNotificacaoLida(id: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    await prisma.$transaction(async (tx) => {
      const n = await tx.notificacaoUsuario.findFirst({ where: { id, usuarioId: autor.id }, select: { id: true, refTipo: true, refId: true, lidaEm: true } });
      if (!n) throw new ErroRegra("Notificação não encontrada.");
      if (n.lidaEm) return;
      const r = await tx.notificacaoUsuario.updateMany({ where: { id, lidaEm: null }, data: { lidaEm: new Date() } });
      if (r.count === 0) return;
      await registrarEvento(tx, { tipo: "NotificacaoLida", agregadoTipo: agregadoDaNotificacao(n.refTipo), agregadoId: n.refId, autorId: autor.id, payload: { notificacaoId: n.id } });
    });
    revalidatePath("/inicio");
    revalidatePath("/inbox");
  });
}
