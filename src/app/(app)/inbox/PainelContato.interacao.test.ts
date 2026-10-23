import { act, createElement, useState } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Documento, type Elemento } from "@/test/dom-minimo";
import type { PainelContato as Painel } from "./PainelContato";
let doc: Documento, container: Elemento, root: Root, PainelContato: typeof Painel;
let render: (visivel: boolean, sobreposto: boolean) => Promise<void>;
const ouvintes: { alvo: object; tipo: string; f: (e: Event) => void; captura: boolean }[] = [];
function eventos(alvo: object) { return {
  addEventListener(tipo: string, f: (e: Event) => void, captura = false) { ouvintes.push({ alvo, tipo, f, captura }); },
  removeEventListener(tipo: string, f: (e: Event) => void) { const i = ouvintes.findIndex((o) => o.alvo === alvo && o.tipo === tipo && o.f === f); if (i >= 0) ouvintes.splice(i, 1); },
}; }
async function disparar(tipo: string, alvo: Elemento, key?: string, shiftKey = false) {
  let parado = false;
  const evento = { type: tipo, target: alvo, button: 0, bubbles: true, key, shiftKey,
    preventDefault: vi.fn(), stopPropagation() { parado = true; } };
  await act(async () => {
    for (const objeto of [container, doc]) for (const captura of [true, false]) {
      for (const o of [...ouvintes]) if (!parado && o.alvo === objeto && o.tipo === tipo && o.captura === captura) o.f(evento as unknown as Event);
    }
  });
}
const trigger = () => container.querySelector('[aria-controls="painel-contato"]')!;
const painel = () => container.querySelector('aside')!;
const fechar = () => container.querySelector('[aria-label="Fechar painel do contato"]')!;
beforeEach(async () => {
  const dom = criarDomMinimo(); doc = dom.documento; ouvintes.length = 0;
  Object.assign(doc, eventos(doc), { querySelector: (s: string) => doc.body.querySelector(s) }); Object.assign(dom.janela, eventos(dom.janela));
  vi.stubGlobal("document", doc); vi.stubGlobal("window", dom.janela); vi.stubGlobal("MutationObserver", dom.MutationObserver); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const { createRoot } = await import("react-dom/client"); ({ PainelContato } = await import("./PainelContato"));
  container = doc.createElement("div"); doc.body.appendChild(container); Object.assign(container, eventos(container)); root = createRoot(container as unknown as HTMLElement);
  function Tela({ inicial, modal }: { inicial: boolean; modal: boolean }) {
    const [aberto, setAberto] = useState(inicial);
    return createElement("div", null,
      createElement("button", { "aria-controls": "painel-contato", onClick: () => setAberto(true) }, "Painel"),
      createElement(PainelContato, { visivel: aberto, sobreposto: modal && aberto, className: "", focarAoAbrir: true, aoFechar: () => setAberto(false) }, createElement("input", { "aria-label": "Campo preservado" })));
  }
  render = async (visivel, sobreposto) => { await act(async () => root.render(createElement(Tela, { inicial: visivel, modal: sobreposto }))); };
});
afterEach(async () => { if (root) await act(async () => root.unmount()); desligarObservadores(); vi.unstubAllGlobals(); });
it("abrir sobreposição foca fechar; Tab fica no painel; Escape fecha e retorna ao gatilho", async () => {
  await render(false, true); expect(painel().inert).toBe(true);
  trigger().focus(); await disparar("click", trigger()); expect(doc.activeElement === fechar()).toBe(true); expect(painel().inert).toBe(false);
  const campo = container.querySelector('input')!; campo.focus(); await disparar("keydown", campo, "Tab"); expect(doc.activeElement === fechar()).toBe(true);
  await disparar("keydown", fechar(), "Escape"); expect(painel().inert).toBe(true); expect(doc.activeElement === trigger()).toBe(true);
});
it("coluna automática não captura foco e mudança de modo preserva a mesma montagem", async () => {
  await render(true, false); expect(doc.activeElement === fechar()).toBe(false);
  const campo = container.querySelector('input')! as Elemento & { value: string }; campo.value = "rascunho";
  await render(true, true); expect(container.querySelector('input') === campo).toBe(true); expect(campo.value).toBe("rascunho");
  await render(true, false); expect(container.querySelector('input') === campo).toBe(true);
});

it("abertura manual em coluna também foca o painel; Escape dentro dele retorna ao gatilho", async () => {
  await render(false, false); trigger().focus(); await disparar("click", trigger());
  expect(doc.activeElement === fechar()).toBe(true);
  await disparar("keydown", fechar(), "Escape"); expect(painel().inert).toBe(true); expect(doc.activeElement === trigger()).toBe(true);
});

it("Escape de um diálogo filho não fecha a coluna do painel", async () => {
  const fecharColuna = vi.fn();
  await act(async () => root.render(createElement(PainelContato, { visivel: true, sobreposto: false, className: "", aoFechar: fecharColuna },
    createElement("div", { role: "alertdialog" }, createElement("button", { "aria-label": "Voltar da confirmação" }, "Voltar")))));
  const voltar = container.querySelector('[aria-label="Voltar da confirmação"]')!;
  voltar.focus(); await disparar("keydown", voltar, "Escape");
  expect(fecharColuna).not.toHaveBeenCalled();
});

it("modal isola irmãos até body, preserva inert anterior e solta antes de devolver foco", async () => {
  const lateral = doc.createElement("nav"), jaInert = doc.createElement("section"); jaInert.inert = true;
  doc.body.appendChild(lateral); doc.body.appendChild(jaInert);
  await render(false, true); trigger().focus(); await disparar("click", trigger());
  expect(trigger().inert).toBe(true); expect(lateral.inert).toBe(true); expect(jaInert.inert).toBe(true);
  expect(doc.activeElement === fechar()).toBe(true);
  await disparar("keydown", fechar(), "Escape");
  expect(trigger().inert).toBe(false); expect(lateral.inert).toBe(false); expect(jaInert.inert).toBe(true);
  expect(doc.activeElement === trigger()).toBe(true);
});
it("troca overlay para coluna ou unmount libera somente isolamento próprio", async () => {
  const lateral = doc.createElement("nav"); doc.body.appendChild(lateral);
  await render(true, true); expect(lateral.inert).toBe(true);
  await render(true, false); expect(lateral.inert).toBe(false);
  await render(true, true); expect(lateral.inert).toBe(true);
  await act(async () => root.unmount()); expect(lateral.inert).toBe(false);
  const { createRoot } = await import("react-dom/client"); root = createRoot(container as unknown as HTMLElement);
});
