function temInert(el: Element): el is HTMLElement { return typeof (el as HTMLElement).inert === "boolean"; }

/** Isolamento local sem portal/véu; percorre somente irmãos dos ancestrais até body. */
export function isolarFundoDoPainel(painel: HTMLElement): () => void {
  const tocados: HTMLElement[] = [];
  for (let camada: HTMLElement | null = painel; camada?.parentElement; camada = camada.parentElement) {
    for (const irmao of Array.from(camada.parentElement.children)) {
      if (irmao === camada || !temInert(irmao) || irmao.inert || ["SCRIPT", "STYLE", "LINK", "TEMPLATE"].includes(irmao.tagName)) continue;
      irmao.inert = true; tocados.push(irmao);
    }
    if (camada.parentElement === painel.ownerDocument.body) break;
  }
  let solto = false;
  return () => { if (solto) return; solto = true; for (const el of tocados) el.inert = false; };
}
