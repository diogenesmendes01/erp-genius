import type { UsuarioSessao } from "@/server/_shared";
import { listarAtendimentosPagina, listarMensagensPagina, type ItemListaInbox } from "@/server/inbox/consultas-pagina";
import type { FiltrosInbox } from "@/server/inbox/filtros";
import type { MensagemThread } from "@/server/whatsapp/consultas-inbox";

// Leituras do Inbox para as suítes de integração. Substituem `listarConversas`/`carregarThread` do Inbox antigo
// (removidos com o código morto do CRM antigo): as regras de acesso são as mesmas (`escopoAtendimentos`), agora
// conferidas pelas consultas que a tela usa. O painel lateral (podeEnviar, lead, cobrança) é `carregarPainel`.

/** Primeira página da lista do Inbox, como a tela a carrega (sem cursor). */
export async function listaDoInbox(u: UsuarioSessao, filtros: FiltrosInbox = {}): Promise<ItemListaInbox[]> {
  return (await listarAtendimentosPagina(u, filtros, null, 200)).itens;
}

/** Mensagens mais recentes da thread; null fora do escopo do usuário. */
export async function mensagensDoInbox(u: UsuarioSessao, atendimentoId: string): Promise<MensagemThread[] | null> {
  return (await listarMensagensPagina(u, atendimentoId, { limite: 100 }))?.mensagens ?? null;
}
