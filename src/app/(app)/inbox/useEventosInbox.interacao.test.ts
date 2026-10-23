import { act, createElement, StrictMode } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Elemento } from "@/test/dom-minimo";
import type { AvisoInbox } from "@/server/inbox/barramento";
import type { FonteEventos } from "@/lib/eventos-inbox";

let useEventosInbox: typeof import("./useEventosInbox").useEventosInbox;
let root: Root, container: Elemento;
const fontes: FonteFalsa[] = [];
let maximoAtivas = 0;
class FonteFalsa implements FonteEventos {
  readyState = 0;
  onopen: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  readonly ouvintes = new Map<string, (e: Event) => void>();
  constructor(readonly url: string) {
    fontes.push(this);
    maximoAtivas = Math.max(maximoAtivas, fontes.filter((f) => f.readyState !== 2).length);
  }
  addEventListener(tipo: string, f: (e: Event) => void) { this.ouvintes.set(tipo, f); }
  close() { this.readyState = 2; }
  abrir() { this.readyState = 1; this.onopen?.(new Event("open")); }
  emitir() {
    this.ouvintes.get("mensagem.nova")?.({ data: JSON.stringify({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m1", conversaId: "c1" }) } as MessageEvent<string>);
  }
}
function Observador({ nome, aoAviso }: { nome: string; aoAviso(a: AvisoInbox): void }) {
  const { conectado } = useEventosInbox(aoAviso);
  return createElement("output", { "aria-label": nome }, conectado ? "Conectado" : "Desconectado");
}
beforeEach(async () => {
  const dom = criarDomMinimo();
  vi.stubGlobal("document", dom.documento); vi.stubGlobal("window", dom.janela);
  vi.stubGlobal("MutationObserver", dom.MutationObserver); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("EventSource", FonteFalsa); fontes.length = 0; maximoAtivas = 0;
  const { createRoot } = await import("react-dom/client");
  ({ useEventosInbox } = await import("./useEventosInbox"));
  container = dom.documento.createElement("div"); dom.documento.body.appendChild(container);
  root = createRoot(container as unknown as HTMLElement);
});
afterEach(async () => {
  await act(async () => root.unmount()); desligarObservadores(); vi.unstubAllGlobals();
});
const estado = (nome: string) => container.querySelector('[aria-label="' + nome + '"]')?.textContent;

it("dois hooks compartilham uma fonte, atualizam conectado e entregam ao callback atual sem reinscrever", async () => {
  const antigo = vi.fn(), atual = vi.fn(), outro = vi.fn();
  const tela = (callback: (a: AvisoInbox) => void, primeiro = true) => [
    primeiro ? createElement(Observador, { key: "a", nome: "Primeiro", aoAviso: callback }) : null,
    createElement(Observador, { key: "b", nome: "Segundo", aoAviso: outro }),
  ];
  await act(async () => root.render(tela(antigo)));
  expect(estado("Primeiro")).toBe("Desconectado"); expect(estado("Segundo")).toBe("Desconectado");
  expect(fontes).toHaveLength(1); expect(fontes[0].url).toBe("/api/inbox/eventos");
  await act(async () => fontes[0].abrir());
  expect(estado("Primeiro")).toBe("Conectado"); expect(estado("Segundo")).toBe("Conectado");
  await act(async () => fontes[0].emitir());
  expect(antigo).toHaveBeenCalledTimes(1); expect(outro).toHaveBeenCalledTimes(1);
  await act(async () => root.render(tela(atual)));
  await act(async () => fontes[0].emitir());
  expect(antigo).toHaveBeenCalledTimes(1);
  expect(atual).toHaveBeenCalledWith({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m1", conversaId: "c1" });
  expect(outro).toHaveBeenCalledTimes(2); expect(fontes).toHaveLength(1);
  await act(async () => root.render(tela(atual, false)));
  expect(fontes[0].readyState).toBe(1);
  await act(async () => fontes[0].emitir());
  expect(atual).toHaveBeenCalledTimes(1); expect(outro).toHaveBeenCalledTimes(3);
  await act(async () => root.render(null));
  expect(fontes[0].readyState).toBe(2); expect(maximoAtivas).toBe(1);
  await act(async () => fontes[0].emitir());
  expect(outro).toHaveBeenCalledTimes(3);
});

it("StrictMode limpa o ciclo antigo, não mantém duas fontes e ignora callbacks após desmontar", async () => {
  const aviso = vi.fn();
  await act(async () => root.render(createElement(StrictMode, null, createElement(Observador, { nome: "Estrito", aoAviso: aviso }))));
  expect(maximoAtivas).toBe(1);
  const ativa = fontes.at(-1)!;
  const abrirAntiga = ativa.onopen!;
  await act(async () => ativa.abrir()); expect(estado("Estrito")).toBe("Conectado");
  await act(async () => root.render(null));
  expect(fontes.every((f) => f.readyState === 2)).toBe(true);
  await act(async () => { abrirAntiga(new Event("open")); ativa.emitir(); });
  expect(aviso).not.toHaveBeenCalled();
  await act(async () => root.render(createElement(Observador, { nome: "Novo", aoAviso: aviso })));
  expect(estado("Novo")).toBe("Desconectado");
  expect(maximoAtivas).toBe(1);
});

it("sem EventSource o hook permanece desconectado e não cria transporte", async () => {
  vi.stubGlobal("EventSource", undefined);
  await act(async () => root.render(createElement(Observador, { nome: "Sem transporte", aoAviso() {} })));
  expect(estado("Sem transporte")).toBe("Desconectado"); expect(fontes).toHaveLength(0);
});
