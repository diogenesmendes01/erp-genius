import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Documento, type Elemento } from "@/test/dom-minimo";
import type { TelaRetorno, NavegacaoRetorno } from "@/test/dialogo-retorno.test.fixture";
let doc:Documento,container:Elemento,root:Root,Tela:typeof TelaRetorno,Navegacao:typeof NavegacaoRetorno;
let alvo:{current:HTMLElement|null};const ouvintes=new Set<(e:KeyboardEvent)=>void>();let ligacoes:number;
beforeEach(async()=>{const dom=criarDomMinimo();doc=dom.documento;ouvintes.clear();ligacoes=0;Object.assign(doc,{addEventListener(t:string,f:(e:KeyboardEvent)=>void){if(t==="keydown"){ouvintes.add(f);ligacoes++;}},removeEventListener(t:string,f:(e:KeyboardEvent)=>void){if(t==="keydown")ouvintes.delete(f);}});vi.stubGlobal("document",doc);vi.stubGlobal("window",dom.janela);vi.stubGlobal("MutationObserver",dom.MutationObserver);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);const {createRoot}=await import("react-dom/client");({TelaRetorno:Tela,NavegacaoRetorno:Navegacao}=await import("@/test/dialogo-retorno.test.fixture"));container=doc.createElement("div");doc.body.appendChild(container);root=createRoot(container as unknown as HTMLElement);alvo={current:null};});
afterEach(async()=>{if(root)await act(async()=>root.unmount());desligarObservadores();vi.unstubAllGlobals();});
const obter=(n:string)=>container.querySelector('[aria-label="'+n+'"]')!;
async function render(aberto:boolean,explicito=false,isolar=false,versao=0){await act(async()=>root.render(createElement(Tela,{aberto,explicito,isolar,versao,focoAoFecharRef:alvo})));}
it("ausente conserva retorno ao gatilho capturado",async()=>{await render(false);const gatilho=obter("Gatilho");gatilho.focus();await render(true);expect(doc.activeElement===obter("Dentro")).toBe(true);await render(false);expect(doc.activeElement===gatilho).toBe(true);});
it("alvo explícito atualizado pelo mesmo ref evita gatilho oculto e não reinstala listener",async()=>{
 await render(false,true);const gatilho=obter("Gatilho");gatilho.focus();await render(true,true);const focoGatilho=vi.spyOn(gatilho,"focus");const busca=obter("Busca");alvo.current=busca as unknown as HTMLElement;await render(true,true,false,1);expect(ligacoes).toBe(1);expect(focoGatilho).not.toHaveBeenCalled();gatilho.inert=true;await render(false,true);expect(doc.activeElement===busca).toBe(true);expect(focoGatilho).not.toHaveBeenCalled();
});
it("ref explícito null suprime retorno e não cai no gatilho conectado",async()=>{await render(false,true);const gatilho=obter("Gatilho");gatilho.focus();await render(true,true);const spy=vi.spyOn(gatilho,"focus");await render(false,true);expect(spy).not.toHaveBeenCalled();});
it("foco explícito só é devolvido após liberar isolamento e ignora destino removido",async()=>{
 await render(false,true,true);obter("Gatilho").focus();await render(true,true,true);const busca=obter("Busca");expect(busca.inert).toBe(true);alvo.current=busca as unknown as HTMLElement;await render(false,true,true);expect(busca.inert).toBe(false);expect(doc.activeElement===busca).toBe(true);
 await render(true,true);const removido=doc.createElement("input");alvo.current=removido as unknown as HTMLElement;const spy=vi.spyOn(removido,"focus");await render(false,true);expect(spy).not.toHaveBeenCalled();
});
it("layout escolhe destino após render de navegação e antes do cleanup passivo",async()=>{
 await act(async()=>root.render(createElement(Navegacao,{aberto:false,focoAoFecharRef:alvo})));const gatilho=obter("Gatilho");gatilho.focus();await act(async()=>root.render(createElement(Navegacao,{aberto:true,focoAoFecharRef:alvo})));const spy=vi.spyOn(gatilho,"focus");await act(async()=>root.render(createElement(Navegacao,{aberto:false,focoAoFecharRef:alvo})));expect(doc.activeElement===obter("Conversa")).toBe(true);expect(spy).not.toHaveBeenCalled();
});
