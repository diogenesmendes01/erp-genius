import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Root } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores } from "@/test/dom-minimo";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import { useAgoraDosPrazos } from "./prazo-vivo";

it("hydrateRoot preserva DOMSSR29min ao hidratar30min e atualiza após assinar sem mismatch", async () => {
  const T = Date.UTC(2026, 9, 22, 12), minuto = 60_000;
  const itens = [{ grupo: false, status: "EM_ATENDIMENTO", prazoRespostaEm: new Date(T - 29 * minuto).toISOString() }] as ItemListaInbox[];
  function Relogio() { const agora = useAgoraDosPrazos(itens, T); return createElement("span", null, String(Math.floor((agora - new Date(itens[0].prazoRespostaEm!).getTime()) / minuto))); }
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] }); vi.setSystemTime(T);
  const dom = criarDomMinimo();
  vi.stubGlobal("window", undefined); vi.stubGlobal("document", dom.documento);
  vi.stubGlobal("MutationObserver", dom.MutationObserver); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let root: Root | undefined;
  try {
    const html = renderToStaticMarkup(createElement(Relogio)); expect(html).toBe("<span>29</span>");
    const container = dom.documento.createElement("div"), span = dom.documento.createElement("span");
    // Esta folha SSR não tem atributos; o DOM mínimo não expõe NamedNodeMap.
    Object.defineProperty(span, "attributes", { value: [] });
    span.textContent = "29"; container.appendChild(span); dom.documento.body.appendChild(container);
    vi.stubGlobal("window", dom.janela); vi.setSystemTime(T + minuto);
    const { hydrateRoot } = await import("react-dom/client"); const erro = vi.fn();
    await act(async () => { root = hydrateRoot(container as unknown as HTMLElement, createElement(Relogio), { onRecoverableError: erro }); });
    expect(erro).not.toHaveBeenCalled(); expect(container.firstChild).toBe(span);
    expect(container.textContent).toBe("30"); expect(vi.getTimerCount()).toBe(1);
  } finally {
    if (root) await act(async () => root!.unmount());
    desligarObservadores(); vi.useRealTimers(); vi.unstubAllGlobals();
  }
});

it.each([undefined, NaN, Infinity, 8_640_000_000_000_001])("SSR sem instante válido(%s) usa0 determinístico sem consultar Date.now", inicial => {
  const agora = vi.spyOn(Date, "now");
  try {
    function Snapshot() { return createElement("span", null, String(useAgoraDosPrazos([], inicial))); }
    expect(renderToStaticMarkup(createElement(Snapshot))).toBe("<span>0</span>");
    expect(agora).not.toHaveBeenCalled();
  } finally { agora.mockRestore(); }
});
