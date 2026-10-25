import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Documento, type Elemento } from "@/test/dom-minimo";
import { ControladorTransferir } from "./ControladorTransferir";
import { Botao } from "@/components/Botao";
let root: Root, host: Elemento, doc: Documento;
const fechar = vi.fn();
const teclas: { tipo: string; fn: (e: unknown) => void }[] = [];
let gatilho: Elemento;
function props(el: Elemento) { const key = Object.keys(el).find(k => k.startsWith("__reactProps"))!; return (el as unknown as Record<string, { onClick(): void; onChange(e: unknown): void; onSubmit(e: unknown): void }>)[key]; }
const executar = vi.fn();
const carregar = vi.fn(); const concluir = vi.fn(); const resumo = vi.fn();
async function montar(permitido = true, id = "a", responsavelAtualId = "atual", setor = false, pessoas = permitido) {
 await act(async () => root.render(createElement(ControladorTransferir, { atendimentoId: id, identidade: "u:"+id, responsavelAtualId, opcoes: { visivel: permitido, pessoas, setores: setor ? ["SECRETARIA"] : [], filaDoSetor: null, aria: false }, destinos: [], executar, carregarPessoas: carregar, carregarResumo: resumo, aoConcluir: concluir, renderizar: ({transferir,dialogo}) => createElement("div",null, transferir && createElement(Botao,{ref:transferir.gatilhoRef,onClick:transferir.aoEscolher},"Abrir"),dialogo) })));
}const botao = (texto: string) => doc.body.querySelectorAll("button").find(b => b.textContent === texto)!;
async function clicar(texto: string) { await act(async () => props(botao(texto)).onClick()); }
async function mudar(tag: string, valor: string) { await act(async () => props(doc.body.querySelector(tag)!).onChange({target:{value:valor}})); }
async function confirmar() { await act(async () => props(doc.body.querySelector("form")!).onSubmit({preventDefault(){}})); }
beforeEach(async () => {
  fechar.mockReset(); executar.mockReset(); carregar.mockReset(); concluir.mockReset(); resumo.mockReset(); resumo.mockResolvedValue(false); carregar.mockResolvedValue([{id:"atual",nome:"Atual"},{id:"b",nome:"Beatriz"}]); executar.mockResolvedValue({ok:true}); teclas.length = 0;
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
it("integra escolha, leitura de pessoas e executor; exclui responsável atual e ACK conclui", async () => {
 await montar(); expect(carregar).not.toHaveBeenCalled(); await clicar("Abrir"); await clicar("Pessoas");
 expect(doc.body.querySelectorAll("option").map(o=>o.textContent)).toEqual(["Escolha…","Beatriz"]);
 await mudar("select","b"); await confirmar(); expect(executar).toHaveBeenCalledOnce(); expect(concluir).toHaveBeenCalledOnce(); expect(doc.body.querySelector('[role="dialog"]')).toBeNull();
});
it("perda e restauração só permitem fechar; nova abertura deliberada recupera CTA", async () => {
 await montar(); await clicar("Abrir"); await montar(false); await montar(true);
 expect(doc.body.textContent).toContain("Feche e abra novamente"); expect(botao("Transferir")).toBeUndefined();
 await clicar("Fechar"); await clicar("Abrir"); expect(botao("Pessoas")).toBeDefined();
});
it("leitura velha A→B→A não publica pessoas em outra abertura", async () => {
 let resolver!:(v:{id:string;nome:string}[])=>void; carregar.mockReturnValueOnce(new Promise(r=>resolver=r));
 await montar(); await clicar("Abrir"); await montar(true,"b"); await montar(true,"a");
 await act(async()=>resolver([{id:"velho",nome:"Resultado antigo"}])); expect(doc.body.textContent).not.toContain("Resultado antigo");
 expect(executar).not.toHaveBeenCalled();
});
it("nova abertura não reutiliza pessoas antigas antes da nova leitura", async () => {
 await montar(); await clicar("Abrir"); await clicar("Cancelar");
 let resolver!:(v:{id:string;nome:string}[])=>void; carregar.mockReturnValueOnce(new Promise(r=>resolver=r));
 await clicar("Abrir"); await clicar("Pessoas"); expect(doc.body.querySelectorAll("option").some(o=>o.textContent==="Beatriz")).toBe(false);
 await act(async()=>resolver([{id:"c",nome:"Carla"}])); expect(doc.body.textContent).toContain("Carla");
});

it("troca de responsável invalida ACK mesmo que gerente conserve as mesmas capacidades", async () => {
 let resolver!:(r:{ok:true})=>void; executar.mockReturnValueOnce(new Promise(r=>resolver=r));
 await montar(); await clicar("Abrir"); await clicar("Pessoas"); await mudar("select","b");
 await confirmar(); await montar(true,"a","c"); await act(async()=>resolver({ok:true}));
 expect(concluir).not.toHaveBeenCalled(); expect(doc.body.textContent).toContain("Feche e abra novamente");
});
it("369 carrega somente booleano do resumo na abertura e o leva ao passo setorial",async()=>{
 resumo.mockResolvedValue(true);await montar(true,"a","atual",true);expect(resumo).not.toHaveBeenCalled();await clicar("Abrir");await clicar("Equipes e filas");await mudar("select","SECRETARIA");
 expect(resumo).toHaveBeenCalledExactlyOnceWith("a");expect(doc.body.querySelector('input[type="checkbox"]')!==null).toBe(true);expect(executar).not.toHaveBeenCalled();
});
it("369 transferir setor sem alçada de pessoas ainda consulta resumo, sem listar colegas",async()=>{
 resumo.mockResolvedValue(true);await montar(true,"a","atual",true,false);await clicar("Abrir");expect(carregar).not.toHaveBeenCalled();expect(resumo).toHaveBeenCalledExactlyOnceWith("a");await clicar("Equipes e filas");await mudar("select","SECRETARIA");expect(doc.body.querySelector('input[type="checkbox"]')!==null).toBe(true);
});
it("369 resposta tardia de resumo não revive checkbox de uma abertura anterior",async()=>{
 let resolver!:(v:boolean)=>void;resumo.mockReturnValueOnce(new Promise(r=>resolver=r)).mockResolvedValueOnce(false);await montar(true,"a","atual",true);await clicar("Abrir");await clicar("Cancelar");await clicar("Abrir");await clicar("Equipes e filas");await mudar("select","SECRETARIA");expect(doc.body.querySelector('input[type="checkbox"]')).toBeNull();await act(async()=>resolver(true));expect(doc.body.querySelector('input[type="checkbox"]')).toBeNull();
});
