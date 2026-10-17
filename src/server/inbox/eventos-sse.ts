import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared";
import { escopoAtendimentos, escopoGrupos } from "@/server/whatsapp/escopo";
import type { AvisoInbox } from "./barramento";

export const TTL_FILTRO_MS = 10_000;

/** Quadro SSE: `event: <tipo>`, `data: <json>` e linha em branco. */
export function formatarSSE(a: AvisoInbox): string {
  return `event: ${a.tipo}\ndata: ${JSON.stringify(a)}\n\n`;
}

/**
 * Filtro de avisos por escopo do usuário, com cache por atendimento (ou conversa de grupo) por
 * `ttlMs`. O aviso não carrega conteúdo; o filtro só decide se o usuário é avisado. Fail-closed:
 * aviso sem atendimento só passa se for conversa de grupo dentro do `escopoGrupos`.
 */
export function criarFiltroDeAvisos(usuario: UsuarioSessao, ttlMs: number = TTL_FILTRO_MS): (a: AvisoInbox) => Promise<boolean> {
  const cache = new Map<string, { ate: number; visivel: boolean }>();
  const decidir = async (a: AvisoInbox): Promise<boolean> => {
    if (a.atendimentoId) {
      const achou = await prisma.atendimentoWhatsApp.findFirst({
        where: { AND: [{ id: a.atendimentoId }, await escopoAtendimentos(usuario)] }, select: { id: true },
      });
      return !!achou;
    }
    const grupo = await prisma.conversaWhatsApp.findFirst({
      where: { id: a.conversaId, grupoId: { not: null }, grupo: { is: await escopoGrupos(usuario) } }, select: { id: true },
    });
    return !!grupo;
  };
  return async (a) => {
    const chave = a.atendimentoId ? `a:${a.atendimentoId}` : `c:${a.conversaId}`;
    const agora = Date.now();
    const c = cache.get(chave);
    if (c && c.ate > agora) return c.visivel;
    const visivel = await decidir(a);
    cache.set(chave, { ate: agora + ttlMs, visivel });
    return visivel;
  };
}
