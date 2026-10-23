import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, Elemento, type Documento } from "@/test/dom-minimo";
import { VirtualList } from "./VirtualList";

type Item = { id: string };
let doc: Documento, scroll: Elemento & { scrollTop: number; clientHeight: number; clientTop: number }, root: Root;
const ouvintes: { tipo: string; f: (e: Event) => void; captura: boolean }[] = [];
const frames = new Map<number, FrameRequestCallback>(); let quadroId = 0;
const chave = (item: Item) => item.id;
const itens = (n: number) => Array.from({ length: n }, (_, i) => ({ id: "r" + i }));
let fracionaria = false;
const altura = (id: string) => fracionaria ? (Number(id.slice(1)) % 3 === 0 ? 71.75 : 71.875) : Number(id.slice(1)) % 3 === 0 ? 90 : 50;
const topo = (id: string) => itens(Number(id.slice(1))).reduce((s, i) => s + altura(i.id), 0);
const botao = (id: string) => scroll.querySelector('[data-row="' + id + '"]');
const props = (n: number) => ({ items: itens(n), getKey: chave, estimatedHeight: 72, scrollRef: { current: scroll as unknown as HTMLElement }, stableMount: true,
  renderItem: (item: Item) => createElement("button", { "data-row": item.id }, item.id) });
async function render(n: number) { await act(async () => root.render(createElement(VirtualList<Item>, props(n)))); }
async function eventos(tipo: string, alvo: Elemento) { await act(async () => {
  const e = { type: tipo, target: alvo, bubbles: true, relatedTarget: null, stopPropagation() {}, preventDefault() {} } as unknown as Event;
  for (const captura of [true, false]) for (const o of [...ouvintes]) if (o.tipo === tipo && o.captura === captura) o.f(e);
}); }
async function rolarEFocar() {
  scroll.scrollTop = topo("r40") - 80;
  await eventos("scroll", scroll);
  await act(async () => { const fila = [...frames.values()]; frames.clear(); fila.forEach(f => f(0)); });
  botao("r40")!.focus(); await eventos("focusin", botao("r40")!);
}
beforeEach(async () => {
  fracionaria = false;
  const dom = criarDomMinimo(); doc = dom.documento; ouvintes.length = 0; frames.clear();
  vi.stubGlobal("document", doc); vi.stubGlobal("window", dom.janela); vi.stubGlobal("MutationObserver", dom.MutationObserver);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("getComputedStyle", () => ({ visibility: "visible" }));
  vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => { frames.set(++quadroId, f); return quadroId; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  scroll = doc.createElement("div") as typeof scroll; Object.assign(scroll, { scrollTop: 0, clientHeight: 500, clientTop: 0 });
  Object.assign(scroll, { addEventListener(tipo: string, f: (e: Event) => void, captura = false) { ouvintes.push({ tipo, f, captura }); }, removeEventListener(tipo: string, f: (e: Event) => void) { const i = ouvintes.findIndex(o => o.tipo === tipo && o.f === f); if (i >= 0) ouvintes.splice(i, 1); } });
  Object.defineProperty(Elemento.prototype, "dataset", { configurable: true, get(this: Elemento) { return { virtualKey: this.getAttribute("data-virtual-key") }; } });
  Object.defineProperty(Elemento.prototype, "tabIndex", { configurable: true, get(this: Elemento) { return this.tagName === "BUTTON" ? 0 : -1; } });
  Object.defineProperty(Elemento.prototype, "getClientRects", { configurable: true, value() { return [this.getBoundingClientRect()]; } });
  Object.defineProperty(Elemento.prototype, "getBoundingClientRect", { configurable: true, value(this: Elemento) {
    if (this === scroll) return { top: 0, bottom: 500, left: 0, right: 500, width: 500, height: 500 };
    const id = this.getAttribute("data-virtual-key") ?? this.getAttribute("data-row");
    const row = this.getAttribute("data-row") ? this.parentElement : this;
    const absolute = (row?.getAttribute("class") ?? "").split(" ").includes("absolute");
    const y = id ? (absolute ? Number.parseFloat(String(row?.style.top)) : topo(id)) - scroll.scrollTop : -scroll.scrollTop;
    const h = id ? altura(id) : Number.parseFloat(String(this.style.height)) || 500;
    return { top: y, bottom: y + h, left: 0, right: 500, width: 500, height: h };
  } });
  doc.body.appendChild(scroll); const { createRoot } = await import("react-dom/client"); root = createRoot(scroll as unknown as HTMLElement);
});
afterEach(async () => { await act(async () => root.unmount()); for (const p of ["dataset", "tabIndex", "getClientRects", "getBoundingClientRect"]) delete (Elemento.prototype as unknown as Record<string, unknown>)[p]; desligarObservadores(); vi.unstubAllGlobals(); });

it("opt-in conserva o mesmo pai, linha, botão focado e viewport na transição99→101", async () => {
  await render(99); await rolarEFocar(); const anterior = botao("r40")!, pai = anterior.parentElement, raiz = pai?.parentElement;
  const offset = (anterior as unknown as HTMLElement).getBoundingClientRect().top;
  await render(101);
  expect(botao("r40") === anterior).toBe(true); expect(anterior.parentElement === pai).toBe(true); expect(pai?.parentElement === raiz).toBe(true);
  expect(doc.activeElement === anterior).toBe(true); expect((anterior as unknown as HTMLElement).getBoundingClientRect().top).toBe(offset);
  expect(scroll.querySelector('[data-virtual-count="101"]')).not.toBeNull();
});
it("opt-in usa alturas variáveis medidas antes de ativar e mantém âncora/foco ao voltar abaixo do limite", async () => {
  await render(99); await rolarEFocar(); const inicial = scroll.scrollTop;
  await render(101); expect(botao("r40")).not.toBeNull(); expect(scroll.scrollTop).toBe(inicial);
  expect((botao("r40") as unknown as HTMLElement).getBoundingClientRect().top).toBe(80);
  await render(99); expect(scroll.scrollTop).toBe(inicial); expect(doc.activeElement === botao("r40")).toBe(true);
});
it("SSR default continua sem wrapper e opt-in fornece a mesma estrutura de pai/rows abaixo do limite", () => {
  const p = { ...props(2), stableMount: undefined };
  expect(renderToStaticMarkup(createElement(VirtualList<Item>, p))).toBe('<button data-row="r0">r0</button><button data-row="r1">r1</button>');
  const h = renderToStaticMarkup(createElement(VirtualList<Item>, props(2)));
  expect(h).toContain('data-virtual-key="r0"'); expect(h).not.toContain('absolute'); expect(h).not.toContain('data-virtual-count');
});

it("opt-in não acumula diferenças subpixel ignoradas perto da altura estimada", async () => {
  fracionaria = true; await render(99); await rolarEFocar();
  const antes = (botao("r40") as unknown as HTMLElement).getBoundingClientRect().top;
  await render(101);
  expect((botao("r40") as unknown as HTMLElement).getBoundingClientRect().top).toBe(antes);
});
