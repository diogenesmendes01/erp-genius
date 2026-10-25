import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Documento, type Elemento } from "@/test/dom-minimo";
import { PopoverTransferir } from "./PopoverTransferir";
let root: Root, host: Elemento, doc: Documento;
const fechar = vi.fn();
const teclas: { tipo: string; fn: (e: unknown) => void }[] = [];
let gatilho: Elemento;
function props(el: Elemento) { const key = Object.keys(el).find(k => k.startsWith("__reactProps"))!; return (el as unknown as Record<string, { onClick(): void; onChange(e: unknown): void; onSubmit(e: unknown): void }>)[key]; }
const executar = vi.fn();
async function montar(ocupado = false) {
 await act(async () => root.render(createElement(PopoverTransferir, { atendimentoId: "a", ancora: { current: gatilho as unknown as HTMLButtonElement }, opcoes: { visivel: true, pessoas: true, setores: ["SECRETARIA"], filaDoSetor: "COMERCIAL", aria: true }, pessoas: [{id:"b",nome:"Beatriz"}], destinos: [], ocupado, aoFechar: fechar, aoExecutar: executar })));
}
const botao = (texto: string) => doc.body.querySelectorAll("button").find(b => b.textContent === texto)!;
async function clicar(texto: string) { await act(async () => props(botao(texto)).onClick()); }
async function mudar(tag: string, valor: string) { await act(async () => props(doc.body.querySelector(tag)!).onChange({target:{value:valor}})); }
async function confirmar() { await act(async () => props(doc.body.querySelector("form")!).onSubmit({preventDefault(){}})); }
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
  doc.createElement = ((tag: string) => { const el = original(tag); if (tag === "select") Object.defineProperty(el, "options", { get: () => el.querySelectorAll("option") }); Object.assign(el, { getBoundingClientRect: () => ({ width: 340, height: 300 }) }); return el; }) as typeof doc.createElement;
  const { createRoot } = await import("react-dom/client"); root = createRoot(host as unknown as HTMLElement);
});
afterEach(async () => { await act(async () => root.unmount()); desligarObservadores(); vi.unstubAllGlobals(); });
it("pessoa exige seleção, conserva contexto ao voltar e só confirma por submit", async () => {
 executar.mockReset(); await montar(); await clicar("Pessoas");
 expect(botao("Transferir").hasAttribute("disabled")).toBe(true);
 await mudar("select", "b"); await mudar("textarea", "  Contexto preservado  ");
 await clicar("Voltar"); await clicar("Pessoas");
 expect((doc.body.querySelector("textarea") as unknown as {value:string}).value).toBe("  Contexto preservado  ");
 expect(executar).not.toHaveBeenCalled(); await confirmar();
 expect(executar).toHaveBeenCalledWith({alvo:{tipo:"pessoa",usuarioId:"b"},contexto:"Contexto preservado"});
});
it("setor mantém mínimo histórico; fila não exige contexto de outro destino", async () => {
 executar.mockReset(); await montar(); await clicar("Equipes e filas"); await mudar("select", "SECRETARIA");
 await mudar("textarea", "curto"); await confirmar(); expect(executar).not.toHaveBeenCalled();
 await mudar("textarea", "Contexto suficiente"); await confirmar();
 expect(executar).toHaveBeenLastCalledWith({alvo:{tipo:"setor",setor:"SECRETARIA",destinoChave:null},contexto:"Contexto suficiente"});
 await mudar("select", "fila"); await confirmar(); expect(executar).toHaveBeenLastCalledWith({alvo:{tipo:"fila"},contexto:"Contexto suficiente"});
});
it("Aria exige confirmação deliberada e ocupado impede handler de submit", async () => {
 executar.mockReset(); await montar(); await clicar("Devolver para a Aria"); expect(executar).not.toHaveBeenCalled();
 await montar(true); await confirmar(); expect(executar).not.toHaveBeenCalled();
 await montar(false); await confirmar(); expect(executar).toHaveBeenCalledWith({alvo:{tipo:"aria"},contexto:""});
});


it("a mudança de passo mantém foco num campo da mesma abertura", async () => {
 await montar(); await clicar("Pessoas"); expect(doc.activeElement === doc.body.querySelector("select")).toBe(true);
 await clicar("Voltar"); expect(doc.body.contains(doc.activeElement)).toBe(true);
});
