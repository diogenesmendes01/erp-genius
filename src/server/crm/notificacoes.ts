import { escopoAtendimentos } from "@/server/whatsapp/escopo";
import type { TipoNotificacao } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { registrarEvento, type AgregadoTipo } from "@/server/_shared/evento";
import { executarAcao, type Resultado } from "@/server/_shared/resultado";
import { ErroRegra, exigirSessao, type UsuarioSessao } from "@/server/_shared/sessao";

export type NotificacaoItem = { id: string; tipo: TipoNotificacao; titulo: string; refTipo: string; refId: string; criadaEm: Date; lida: boolean };

/** Agregado auditado ao marcar como lida: o do item referenciado (SLA → AtendimentoWhatsApp; lembrete → Tarefa). */
const agregadoDaNotificacao = (refTipo: string): AgregadoTipo => (refTipo === "AtendimentoWhatsApp" ? "AtendimentoWhatsApp" : "Tarefa");

/** As 20 ultimas notificacoes visiveis do proprio usuario, na ordem definida pelo banco.
 * Memoria e consultas sao limitadas por pagina; o custo total depende das paginas revogadas.
 */
export async function listarNotificacoes(usuario: UsuarioSessao): Promise<NotificacaoItem[]> {
  if (!usuario?.id) return [];
  // Memo local: nenhuma consulta de escopo sem referencia de mencao valida.
  let escopo: ReturnType<typeof escopoAtendimentos> | undefined;
  const visiveis: NotificacaoItem[] = [];
  let cursor: { criadaEm: Date; id: string } | undefined;
  const tamanhoLote = 100;
  while (visiveis.length < 20) {
    const linhas = await prisma.notificacaoUsuario.findMany({
      where: {
        usuarioId: usuario.id,
        ...(cursor ? { OR: [
          { criadaEm: { lt: cursor.criadaEm } },
          { criadaEm: cursor.criadaEm, id: { lt: cursor.id } },
        ] } : {}),
      },
      orderBy: [{ criadaEm: "desc" }, { id: "desc" }],
      take: tamanhoLote,
      select: { id: true, tipo: true, titulo: true, refTipo: true, refId: true, criadaEm: true, lidaEm: true },
    });
    if (!linhas.length) break;
    const ids = [...new Set(linhas
      .filter(n => n.tipo === "MENCAO_NOTA" && n.refTipo === "AtendimentoWhatsApp")
      .map(n => n.refId))];
    const permitidos = new Set(ids.length ? (await prisma.atendimentoWhatsApp.findMany({
      where: { AND: [
        { id: { in: ids } },
        await (escopo ??= escopoAtendimentos(usuario)),
        { conversa: { contatoId: { not: null }, grupoId: null } },
      ] },
      select: { id: true },
    })).map(a => a.id) : []);
    for (const n of linhas) {
      if (n.tipo === "MENCAO_NOTA" && (n.refTipo !== "AtendimentoWhatsApp" || !permitidos.has(n.refId))) continue;
      visiveis.push({ id: n.id, tipo: n.tipo, titulo: n.titulo, refTipo: n.refTipo, refId: n.refId, criadaEm: n.criadaEm, lida: n.lidaEm !== null });
      if (visiveis.length === 20) break;
    }
    if (linhas.length < tamanhoLote) break;
    const ultima = linhas[linhas.length - 1];
    cursor = { criadaEm: ultima.criadaEm, id: ultima.id };
  }
  return visiveis;
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
