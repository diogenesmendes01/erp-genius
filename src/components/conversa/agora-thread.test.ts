import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Root } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores } from "@/test/dom-minimo";
import type { MensagemThread, NotaInternaThread } from "@/server/whatsapp/consultas-inbox";
import { rotuloDia } from "./itens-thread";
import { useAgoraDaThread } from "./agora-thread";

const T = Date.parse("2026-10-22T23:59:00Z");
const antiga = { id: "m1", criadoEm: "2026-10-22T23:00:00Z" } as MensagemThread;
const nova = { id: "m2", criadoEm: "2026-10-23T00:02:00Z" } as MensagemThread;
const notas: NotaInternaThread[] = [];

it("SSR23:59 hidrata00:01 preservando nó e depois nova mensagem00:02 usa dia cliente", async () => {
  const dom = criarDomMinimo(), renderizacoes: string[] = [];
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] }); vi.setSystemTime(T);
  vi.stubGlobal("window", undefined); vi.stubGlobal("document", dom.documento);
  vi.stubGlobal("MutationObserver", dom.MutationObserver); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let root: Root | undefined;
  function Thread({ mensagens, selecionado = "a1", notasAtuais = notas }: { mensagens: MensagemThread[]; selecionado?: string; notasAtuais?: NotaInternaThread[] }) {
    const agora = useAgoraDaThread(mensagens, notasAtuais, selecionado, T);
    const texto = mensagens.map(m => rotuloDia(m.criadoEm, "UTC", new Date(agora))).join("|");
    if (typeof window !== "undefined") renderizacoes.push(texto);
    return createElement("span", null, texto);
  }
  try {
    const mensagens = [antiga];
    expect(renderToStaticMarkup(createElement(Thread, { mensagens }))).toBe("<span>Hoje</span>");
    const container = dom.documento.createElement("div"), span = dom.documento.createElement("span");
    Object.defineProperty(span, "attributes", { value: [] }); span.textContent = "Hoje";
    container.appendChild(span); dom.documento.body.appendChild(container);
    vi.stubGlobal("window", dom.janela); vi.setSystemTime(new Date("2026-10-23T00:01:00Z"));
    const { hydrateRoot } = await import("react-dom/client"), erro = vi.fn();
    await act(async () => { root = hydrateRoot(container as unknown as HTMLElement, createElement(Thread, { mensagens }), { onRecoverableError: erro }); });
    expect(renderizacoes[0]).toBe("Hoje"); expect(erro).not.toHaveBeenCalled(); expect(container.firstChild).toBe(span);
    expect(container.textContent).toBe("Ontem"); expect(vi.getTimerCount()).toBe(0);
    vi.setSystemTime(new Date("2026-10-23T00:02:00Z"));
    const atualizadas = [antiga, nova];
    await act(async () => { root!.render(createElement(Thread, { mensagens: atualizadas })); });
    expect(container.textContent).toBe("Ontem|Hoje");
    vi.setSystemTime(new Date("2026-10-24T00:02:00Z"));
    await act(async () => { root!.render(createElement(Thread, { mensagens: atualizadas })); });
    expect(container.textContent).toBe("Ontem|Hoje"); // ociosidade não cria relógio ativo
    await act(async () => { root!.render(createElement(Thread, { mensagens: atualizadas, selecionado: "a2" })); });
    expect(container.textContent).toBe("22/10/2026|Ontem"); expect(vi.getTimerCount()).toBe(0);
    vi.setSystemTime(new Date("2026-10-25T00:02:00Z"));
    await act(async () => { root!.render(createElement(Thread, { mensagens: atualizadas, selecionado: "a2", notasAtuais: [{ id: "n" } as NotaInternaThread] })); });
    expect(container.textContent).toBe("22/10/2026|23/10/2026"); expect(erro).not.toHaveBeenCalled();
  } finally {
    if (root) await act(async () => root!.unmount());
    desligarObservadores(); vi.useRealTimers(); vi.unstubAllGlobals();
  }
});

it.each([undefined, NaN, Infinity, 8_640_000_000_000_001])("SSR sem epoch válido(%s) usa snapshot neutro estável sem consultar relógio", inicial => {
  vi.stubGlobal("window", undefined);
  const relogio = vi.spyOn(Date, "now");
  try {
    function Snapshot() { return createElement("span", null, String(useAgoraDaThread([], undefined, "a1", inicial))); }
    expect(renderToStaticMarkup(createElement(Snapshot))).toBe("<span>0</span>");
    expect(relogio).not.toHaveBeenCalled();
  } finally { relogio.mockRestore(); vi.unstubAllGlobals(); }
});
