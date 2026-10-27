import type { UsuarioSessao } from "@/server/_shared";
import { listarAtendimentosPagina, listarMensagensPagina, type ItemListaInbox } from "@/server/inbox/consultas-pagina";
import type { FiltrosInbox } from "@/server/inbox/filtros";
import type { MensagemThread } from "@/server/whatsapp/consultas-inbox";

export async function listaDoInbox(u: UsuarioSessao, filtros: FiltrosInbox = {}): Promise<ItemListaInbox[]> {
  return (await listarAtendimentosPagina(u, filtros, null, 200)).itens;
}

export async function mensagensDoInbox(u: UsuarioSessao, atendimentoId: string): Promise<MensagemThread[] | null> {
  return (await listarMensagensPagina(u, atendimentoId, { limite: 100 }))?.mensagens ?? null;
}
