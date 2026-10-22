import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared";
import { PAPEIS_INBOX, escopoAtendimentos } from "@/server/whatsapp/escopo";

/**
 * Atendimentos com não lida PARA ESTE usuário (mesma regra de preferenciasDoUsuario), em qualquer posição da lista.
 * Vira condição da própria consulta paginada (sempre combinada com o escopo), sem varrer o banco todo:
 * - marcada como não lida pelo usuário;
 * - sem leitura registrada (lidaAte nulo ou sem preferência) e contador compartilhado > 0;
 * - com leitura registrada: ENTRADA depois de lidaAte, achada a partir das preferências DO USUÁRIO
 *   (limitadas às conversas dele) e não de todos os atendimentos.
 */
export async function condicaoNaoLidaPessoal(usuarioId: string): Promise<Prisma.AtendimentoWhatsAppWhereInput> {
  const comLeitura = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT DISTINCT a."id" FROM "PreferenciaConversaUsuario" p
    JOIN "AtendimentoWhatsApp" a ON a."conversaId" = p."conversaId"
    WHERE p."usuarioId" = ${usuarioId} AND p."lidaAte" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM "MensagemWhatsApp" m
        WHERE m."atendimentoId" = a."id" AND m."direcao" = 'ENTRADA' AND m."criadoEm" > p."lidaAte")`);
  return { OR: [
    { conversa: { preferenciasUsuarios: { some: { usuarioId, marcadaNaoLida: true } } } },
    { naoLidas: { gt: 0 }, conversa: { preferenciasUsuarios: { none: { usuarioId, lidaAte: { not: null } } } } },
    { id: { in: comLeitura.map((l) => l.id) } },
  ] };
}

export async function contarConversasNaoLidas(u: UsuarioSessao): Promise<number> {
  if (!u.papeis.some((p) => PAPEIS_INBOX.includes(p))) return 0;
  return prisma.atendimentoWhatsApp.count({ where: { AND: [await escopoAtendimentos(u), await condicaoNaoLidaPessoal(u.id)] } });
}
