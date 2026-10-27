import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Documento, type Elemento } from "@/test/dom-minimo";

const registrar = vi.hoisted(() => vi.fn());
vi.mock("@/server/whatsapp/acoes", () => ({ registrarOptOutContato: registrar, removerOptOutContato: vi.fn() }));

let doc: Documento, container: Elemento, root: Root;
const ouvintes: { alvo: object; tipo: string; f: (e: Event) => void; captura: boolean }[] = [];
function eventos(alvo: object) { return {
  addEventListener(tipo: string, f: (e: Event) => void, captura = false) { ouvintes.push({ alvo, tipo, f, captura }); },
  removeEventListener(tipo: string, f: (e: Event) => void) { const i = ouvintes.findIndex((o) => o.alvo === alvo && o.tipo === tipo && o.f === f); if (i >= 0) ouvintes.splice(i, 1); },
}; }
async function disparar(tipo: string, alvo: Elemento, key?: string) {
  let parado = false;
  const evento = { type: tipo, target: alvo, button: 0, bubbles: true, key,
    preventDefault: vi.fn(), stopPropagation() { parado = true; } };
  await act(async () => {
    for (const objeto of [alvo.closest('[role="alertdialog"]') ? doc.body : container, doc]) for (const captura of [true, false]) {
      for (const o of [...ouvintes]) if (!parado && o.alvo === objeto && o.tipo === tipo && o.captura === captura) o.f(evento as unknown as Event);
    }
  });
}
const botao = (texto: string) => doc.body.querySelectorAll("button").find((el) => el.textContent === texto)!;

beforeEach(async () => {
  registrar.mockReset(); ouvintes.length = 0;
  const dom = criarDomMinimo(); doc = dom.documento;
  Object.assign(doc, eventos(doc)); Object.assign(doc.body, eventos(doc.body)); Object.assign(dom.janela, eventos(dom.janela));
  vi.stubGlobal("document", doc); vi.stubGlobal("window", dom.janela);
  vi.stubGlobal("MutationObserver", dom.MutationObserver); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const { createRoot } = await import("react-dom/client");
  const { OptOutContato } = await import("./OptOutContato");
  container = doc.createElement("main"); doc.body.appendChild(container); Object.assign(container, eventos(container));
  root = createRoot(container as unknown as HTMLElement);
  await act(async () => root.render(createElement(OptOutContato, { contatoId: "c-ficticio", nome: "Contato de teste", optOut: false, podeReautorizar: false })));
});
afterEach(async () => { if (root) await act(async () => root.unmount()); desligarObservadores(); vi.unstubAllGlobals(); });

it.each(["Voltar", "Escape"])("cancelar opt-out por %s retorna foco ao botão de origem sem executar a ação", async (modo) => {
  const origem = botao("Registrar opt-out"); origem.focus();
  await disparar("click", origem);
  expect(doc.body.querySelector('[role="alertdialog"]')).not.toBeNull();
  expect(doc.activeElement === botao("Voltar")).toBe(true);
  expect(origem.hasAttribute("disabled")).toBe(false);
  expect(origem.closest("[inert]")).not.toBeNull();
  await disparar(modo === "Escape" ? "keydown" : "click", botao("Voltar"), modo === "Escape" ? "Escape" : undefined);
  expect(doc.body.querySelector('[role="alertdialog"]')).toBeNull();
  expect(doc.activeElement === origem).toBe(true);
  expect(origem.closest("[inert]")).toBeNull();
  expect(registrar).not.toHaveBeenCalled();
});
