/** Integração DOM local da busca. Nenhum seletor interpola IDs e nenhuma operação rola o documento. */
export function elementoVisivel(el: HTMLElement | null): el is HTMLElement {
 return !!el && el.isConnected && el.getClientRects().length > 0 && !el.closest("[inert]");
}
export function controleBuscaVisivel(regiao: HTMLElement, preferirMenu = false): HTMLElement | null {
 const controles = [...regiao.querySelectorAll<HTMLButtonElement>('button[aria-label]')];
 const porNome = (nome: string) => controles.find(el => el.getAttribute("aria-label") === nome && elementoVisivel(el)) ?? null;
 return (preferirMenu ? porNome("Mais ações da conversa") : porNome("Buscar na conversa")) ?? porNome("Mais ações da conversa");
}
export function ligarAtalhoBusca(regiao: HTMLElement, abrir: () => void): () => void {
 const tecla = (e: KeyboardEvent) => {
  const foco = regiao.ownerDocument.activeElement as HTMLElement | null;
  if (e.defaultPrevented || e.isComposing || e.shiftKey || e.altKey || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "f" || !elementoVisivel(regiao) || !foco || !regiao.contains(foco) || foco.closest('[aria-modal="true"]')) return;
  e.preventDefault(); abrir();
 };
 regiao.addEventListener("keydown", tecla);
 return () => regiao.removeEventListener("keydown", tecla);
}
export function rolarAteMensagem(rolagem: HTMLElement, id: string): boolean {
 const el = [...rolagem.querySelectorAll<HTMLElement>("[data-mensagem-id]")].find(el => el.getAttribute("data-mensagem-id") === id);
 if (!el) return false;
 const row = el.getBoundingClientRect(), container = rolagem.getBoundingClientRect();
 rolagem.scrollTop = Math.max(0, rolagem.scrollTop + row.top - container.top - rolagem.clientTop - (rolagem.clientHeight - row.height) / 2);
 return true;
}
