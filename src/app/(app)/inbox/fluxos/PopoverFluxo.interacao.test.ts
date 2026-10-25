import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Documento, type Elemento } from "@/test/dom-minimo";
import { PopoverFluxo } from "./PopoverFluxo";
let root: Root, host: Elemento, doc: Documento;
const fechar = vi.fn();
const teclas: { tipo: string; fn: (e: unknown) => void }[] = [];
let gatilho: Elemento;
function props(el: Elemento) { const key = Object.keys(el).find(k => k.startsWith("__reactProps"))!; return (el as unknown as Record<string, { onClick(): void }>)[key]; }
async function montar(ocupado = false) {
  await act(async () => root.render(createElement(PopoverFluxo, { titulo: "Transferir", ancora: { current: gatilho as unknown as HTMLElement }, ocupado, aoFechar: fechar }, createElement("button", null, "Pessoas"))));
}
beforeEach(async () => {
  fechar.mockReset(); teclas.length = 0;
  const dom = criarDomMinimo(); doc = dom.documento;
  Object.assign(doc, { addEventListener: (tipo: string, fn: (e: unknown) => void) => teclas.push({ tipo, fn }), removeEventListener: (tipo: string, fn: (e: unknown) => void) => { const i = teclas.findIndex(k => k.tipo === tipo && k.fn === fn); if (i >= 0) teclas.splice(i, 1); } });
  Object.assign(dom.janela, { innerWidth: 1280, innerHeight: 800, addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal("window", dom.janela); vi.stubGlobal("document", doc); vi.stubGlobal("MutationObserver", dom.MutationObserver); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  gatilho = doc.createElement("button"); doc.body.appendChild(gatilho); gatilho.focus();
  Object.assign(gatilho, { getBoundingClientRect: () => ({ top: 40, bottom: 76, left: 300, right: 336 }) });
  host = doc.createElement("div"); doc.body.appendChild(host);
  const original = doc.createElement.bind(doc);
  doc.createElement = ((tag: string) => { const el = original(tag); Object.assign(el, { getBoundingClientRect: () => ({ width: 340, height: 300 }) }); return el; }) as typeof doc.createElement;
  const { createRoot } = await import("react-dom/client"); root = createRoot(host as unknown as HTMLElement);
});
afterEach(async () => { await act(async () => root.unmount()); desligarObservadores(); vi.unstubAllGlobals(); });
it("useDialogo real foca conteúdo e devolve ao gatilho sem seletor global", async () => {
  await montar(); const dialogo = doc.body.querySelector('[role="dialog"]')!;
  expect(dialogo).not.toBeNull(); expect(doc.activeElement?.textContent).toBe("Pessoas");
  await act(async () => root.render(null)); expect(doc.activeElement).toBe(gatilho);
});
it("Escape fecha quando livre e não fecha durante execução", async () => {
  await montar(); const esc = () => teclas.filter(k => k.tipo === "keydown").forEach(k => k.fn({ key: "Escape", preventDefault() {}, stopPropagation() {} }));
  await act(async () => esc()); expect(fechar).toHaveBeenCalledOnce(); fechar.mockClear();
  await montar(true); await act(async () => esc()); expect(fechar).not.toHaveBeenCalled();
});
it("clique de fundo fecha sem confirmar e ocupado impede fechamento", async () => {
  await montar(); const dialogo = doc.body.querySelector('[role="dialog"]')!;
  await act(async () => props(dialogo.parentNode as Elemento).onClick()); expect(fechar).toHaveBeenCalledOnce(); fechar.mockClear();
  await montar(true); await act(async () => props(doc.body.querySelector('[role="dialog"]')!.parentNode as Elemento).onClick()); expect(fechar).not.toHaveBeenCalled();
});
