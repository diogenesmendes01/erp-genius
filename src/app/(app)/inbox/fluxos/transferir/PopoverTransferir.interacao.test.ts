import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Documento, type Elemento } from "@/test/dom-minimo";
import { PopoverTransferir, type PessoaTransferir } from "./PopoverTransferir";
let root: Root, host: Elemento, doc: Documento;
const fechar = vi.fn();
const teclas: { tipo: string; fn: (e: unknown) => void }[] = [];
let gatilho: Elemento;
function props(el: Elemento) { const key = Object.keys(el).find(k => k.startsWith("__reactProps"))!; return (el as unknown as Record<string, { onClick(): void; onChange(e: unknown): void; onSubmit(e: unknown): void }>)[key]; }
const executar = vi.fn();
async function montar(ocupado = false, temResumoAria = false, pessoas:PessoaTransferir[]|null=[{id:"b",nome:"Beatriz"}]) {
 await act(async () => root.render(createElement(PopoverTransferir, { atendimentoId: "a", ancora: { current: gatilho as unknown as HTMLButtonElement }, opcoes: { visivel: true, pessoas: true, setores: ["SECRETARIA"], filaDoSetor: "COMERCIAL", aria: true }, pessoas, destinos: [], ocupado, temResumoAria, aoFechar: fechar, aoExecutar: executar })));
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
 await mudar('input[type="radio"]', "b"); await mudar("textarea", "  Contexto preservado  ");
 await clicar("Voltar"); await clicar("Pessoas");
 expect((doc.body.querySelector("textarea") as unknown as {value:string}).value).toBe("  Contexto preservado  ");
 expect(executar).not.toHaveBeenCalled(); await confirmar();
 expect(executar).toHaveBeenCalledWith({alvo:{tipo:"pessoa",usuarioId:"b"},contexto:"Contexto preservado"});
});
it("369 setor aceita contexto curto; fila preserva action sem contexto adicional", async () => {
 executar.mockReset(); await montar(); await clicar("Equipes e filas"); await mudar("select", "SECRETARIA");
 await mudar("textarea", "curto"); await confirmar(); expect(executar).toHaveBeenLastCalledWith({alvo:{tipo:"setor",setor:"SECRETARIA",destinoChave:null},contexto:"curto",anexarResumoAria:false});
 await mudar("textarea", "Contexto suficiente"); await confirmar();
 expect(executar).toHaveBeenLastCalledWith({alvo:{tipo:"setor",setor:"SECRETARIA",destinoChave:null},contexto:"Contexto suficiente",anexarResumoAria:false});
 await mudar("select", "fila"); await confirmar(); expect(executar).toHaveBeenLastCalledWith({alvo:{tipo:"fila"},contexto:"Contexto suficiente"});
});
it("Aria exige confirmação deliberada e ocupado impede handler de submit", async () => {
 executar.mockReset(); await montar(); await clicar("Devolver para a Aria"); expect(executar).not.toHaveBeenCalled();
 await montar(true); await confirmar(); expect(executar).not.toHaveBeenCalled();
 await montar(false); await confirmar(); expect(executar).toHaveBeenCalledWith({alvo:{tipo:"aria"},contexto:""});
});


it("a mudança de passo mantém foco num campo da mesma abertura", async () => {
 await montar(); await clicar("Pessoas"); expect(doc.activeElement === doc.body.querySelector('input[type="radio"]')).toBe(true);
 await clicar("Voltar"); expect(doc.body.contains(doc.activeElement)).toBe(true);
});
it("369 resumo disponível começa marcado, permite desmarcar e só envia booleano de conteúdo",async()=>{
 executar.mockReset();await montar(false,true);await clicar("Equipes e filas");await mudar("select","SECRETARIA");
 const checkbox=doc.body.querySelector('input[type="checkbox"]');expect(checkbox!==null).toBe(true);expect((checkbox as unknown as {checked:boolean}).checked).toBe(true);
 await confirmar();expect(executar).toHaveBeenLastCalledWith({alvo:{tipo:"setor",setor:"SECRETARIA",destinoChave:null},contexto:"",anexarResumoAria:true});
 await act(async()=>props(checkbox!).onChange({target:{checked:false}}));await confirmar();expect(executar).toHaveBeenLastCalledWith({alvo:{tipo:"setor",setor:"SECRETARIA",destinoChave:null},contexto:"",anexarResumoAria:false});
});
it("369 sem resumo o setor confirma vazio sem checkbox, e dado tardio não desfaz escolha humana",async()=>{
 executar.mockReset();await montar(false,false);await clicar("Equipes e filas");await mudar("select","SECRETARIA");expect(doc.body.querySelector('input[type="checkbox"]')).toBeNull();await confirmar();expect(executar).toHaveBeenLastCalledWith({alvo:{tipo:"setor",setor:"SECRETARIA",destinoChave:null},contexto:"",anexarResumoAria:false});
 await montar(false,true);const checkbox=doc.body.querySelector('input[type="checkbox"]')!;expect((checkbox as unknown as {checked:boolean}).checked).toBe(true);await act(async()=>props(checkbox).onChange({target:{checked:false}}));await montar(false,true);expect((doc.body.querySelector('input[type="checkbox"]') as unknown as {checked:boolean}).checked).toBe(false);
});

it("371 Pessoas usa radios nativos e carga indisponível não vira zero",async()=>{
 await montar();await clicar("Pessoas");const campo=doc.body.querySelector('input[type="radio"]');
 expect(campo).not.toBeNull();expect(doc.body.querySelector("fieldset")).not.toBeNull();expect(doc.body.querySelector("legend")?.textContent).toContain("Pessoa");
 expect(campo?.getAttribute("required")).not.toBeNull();expect(doc.body.textContent).toContain("Carga indisponível");expect(doc.body.textContent).not.toContain("0 conversas abertas");
});

it("371 carga0/1/2 em duas linhas e grupo único preservam alvo e foco",async()=>{
 executar.mockReset();await montar(false,false,[{id:"b",nome:"Beatriz",carga:0},{id:"c",nome:"Carla",carga:1},{id:"d",nome:"Diana",carga:2}]);await clicar("Pessoas");
 expect(doc.body.textContent).toContain("0 conversas abertas neste setor");expect(doc.body.textContent).toContain("1 conversa aberta neste setor");expect(doc.body.textContent).toContain("2 conversas abertas neste setor");
 const radios=doc.body.querySelectorAll('input[type="radio"]');expect(radios).toHaveLength(3);expect(new Set(radios.map(r=>(r as unknown as {name:string}).name)).size).toBe(1);
 expect(doc.activeElement).toBe(radios[0]);await act(async()=>props(radios[2]).onChange({target:{value:"d"}}));await clicar("Voltar");await clicar("Pessoas");
 expect(doc.activeElement).toBe(doc.body.querySelectorAll('input[type="radio"]')[2]);await confirmar();expect(executar).toHaveBeenCalledExactlyOnceWith({alvo:{tipo:"pessoa",usuarioId:"d"},contexto:""});
});
it("371 carregando e ocupado não fabricam carga ou seleção; chegada foca o radio local",async()=>{
 await montar(false,false,null);await clicar("Pessoas");expect(doc.body.textContent).toContain("Carregando pessoas");expect(botao("Transferir").hasAttribute("disabled")).toBe(true);
 await montar(false,false,[{id:"b",nome:"Beatriz",carga:2}]);expect(doc.activeElement).toBe(doc.body.querySelector('input[type="radio"]'));
 await montar(true,false,[{id:"b",nome:"Beatriz",carga:2}]);expect(doc.body.querySelector('input[type="radio"]')?.hasAttribute("disabled")).toBe(true);
});
