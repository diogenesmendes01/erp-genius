import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared";
import { escopoAtendimentos, escopoGrupos } from "@/server/whatsapp/escopo";
import type { AvisoInbox } from "./barramento";

export const TTL_FILTRO_MS = 10_000;

/** Quadro SSE: `event: <tipo>`, `data: <json>` e linha em branco. */
export function formatarSSE(a: AvisoInbox): string {
  const { paraUsuarioId: _destinatario, ...publico } = a;
  void _destinatario;
  return `event: ${a.tipo}\ndata: ${JSON.stringify(publico)}\n\n`;
}

/**
 * Filtro de avisos por escopo do usuário, com cache por atendimento (ou conversa de grupo) por
 * `ttlMs`. O aviso não carrega conteúdo; o filtro só decide se o usuário é avisado. Fail-closed:
 * aviso sem atendimento só passa se for conversa de grupo dentro do `escopoGrupos`.
 * Só `visivel: true` é guardado (um "não" em cache faria o usuário perder avisos de quem acabou de ganhar acesso,
 * por transferência ou participação), `atendimento.atualizado` invalida a chave (o escopo pode ter mudado) e o
 * Map é podado de expirados com teto de chaves. `resync` (escuta reconectada) passa sempre. `atendimento.atualizado`
 * direcionado (`paraUsuarioId`, da revogação de convite) passa só para esse usuário e não consulta o escopo: o
 * ex-convidado já está fora dele, e o aviso só carrega ids (o cliente recarrega o painel e recebe 404).
 */
const MAX_CHAVES_CACHE = 500;

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
  const podar = (agora: number) => {
    if (cache.size < MAX_CHAVES_CACHE) return;
    for (const [k, v] of cache) if (v.ate <= agora) cache.delete(k);
    while (cache.size >= MAX_CHAVES_CACHE) cache.delete(cache.keys().next().value!);
  };
  return async (a) => {
    if (a.tipo === "resync") return true;
    if (a.paraUsuarioId !== undefined) {
      if (a.tipo !== "atendimento.atualizado" || a.paraUsuarioId !== usuario.id) return false;
      if (a.atendimentoId) cache.delete(`a:${a.atendimentoId}`);
      return true;
    }
    const chave = a.atendimentoId ? `a:${a.atendimentoId}` : `c:${a.conversaId}`;
    const agora = Date.now();
    if (a.tipo === "atendimento.atualizado") cache.delete(chave);
    const c = cache.get(chave);
    if (c && c.ate > agora) return c.visivel;
    const visivel = await decidir(a);
    if (visivel) { podar(agora); cache.set(chave, { ate: agora + ttlMs, visivel }); } else cache.delete(chave);
    return visivel;
  };
}
