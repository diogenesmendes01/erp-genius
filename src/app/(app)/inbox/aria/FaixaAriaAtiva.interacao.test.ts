import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Documento, type Elemento } from "@/test/dom-minimo";
import { FaixaAriaAtiva } from "./FaixaAriaAtiva";
import { Cabecalho } from "../../aria/_componentes/Cabecalho";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import type { SituacaoAriaInbox } from "@/server/inbox/contagens";
const a = vi.hoisted(() => ({ pausar: vi.fn(), reativar: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:a.refresh})}));
vi.mock("@/server/aria/acoes", () => ({ pausarAria: a.pausar, reativarAria: a.reativar }));
let root: Root, host: Elemento, doc: Documento;
const mudar = vi.fn(), keys: {type:string;fn:(e:unknown)=>void}[]=[];
const situacao: SituacaoAriaInbox={estado:"ATIVA",pausada:false,podeGerenciar:true};
function eventos(el:Elemento){const k=Object.keys(el).find(k=>k.startsWith("__reactProps"))!;return (el as unknown as Record<string,{onClick():void;onChange(e:unknown):void}>)[k];}
const dialogo=()=>doc.body.querySelector('[role="dialog"]');
const botao=(texto:string)=>doc.body.querySelectorAll("button").find(b=>b.textContent===texto)!;
const clicar=async(texto:string)=>act(async()=>{const b=botao(texto);expect(b).toBeDefined();eventos(b).onClick();});
const trocar=async(texto:string)=>act(async()=>{const campo=dialogo()!.querySelector("input")!;eventos(campo).onChange({target:{value:texto}});});
const montar=async(s:Partial<SituacaoAriaInbox>={})=>act(async()=>root.render(createElement(FaixaAriaAtiva,{situacao:{...situacao,...s},contagens:{ia:3,aprovacao:1,handoff:1},aoMudar:mudar})));
beforeEach(async()=>{
 vi.resetAllMocks();a.pausar.mockResolvedValue({ok:true});a.reativar.mockResolvedValue({ok:true});keys.length=0;
 const dom=criarDomMinimo();doc=dom.documento;
 Object.assign(doc,{createElementNS:(_ns:string,t:string)=>doc.createElement(t),addEventListener:(type:string,fn:(e:unknown)=>void)=>keys.push({type,fn}),removeEventListener:(type:string,fn:(e:unknown)=>void)=>{const i=keys.findIndex(k=>k.type===type&&k.fn===fn);if(i>=0)keys.splice(i,1);}});
 Object.assign(dom.janela,{innerWidth:390,innerHeight:844,addEventListener(){},removeEventListener(){}});
 vi.stubGlobal("self",{setTimeout,clearTimeout});vi.stubGlobal("window",dom.janela);vi.stubGlobal("document",doc);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.stubGlobal("MutationObserver",dom.MutationObserver);
 host=doc.createElement("div");doc.body.appendChild(host);const {createRoot}=await import("react-dom/client");root=createRoot(host as unknown as HTMLElement);
});
afterEach(async()=>{await act(async()=>root.unmount());desligarObservadores();vi.unstubAllGlobals();});
it.each(["ATIVA","SHADOW"] as const)("interruptor global em %s reflete pausa fresca sem trocar modo",async estado=>{
 await montar({estado});expect(host.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("true");
 await montar({estado,pausada:true});expect(host.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("false");
 if(estado==="SHADOW")expect(host.textContent).toContain("Aria em ensaio");
});
it("sem capacidade e DESLIGADA não oferecem controle",async()=>{await montar({podeGerenciar:false});expect(host.querySelector('[role="switch"]')).toBeNull();await montar({estado:"DESLIGADA"});expect(host.textContent).toBe("");});
it("motivo obrigatório, Cancelar sem ação, Modal real devolve foco",async()=>{
 await montar();const trigger=host.querySelector('[role="switch"]')!;trigger.focus();await clicar("Aria ativa");
 expect(dialogo()).not.toBeNull();expect(botao("Pausar a Aria").hasAttribute("disabled")).toBe(true);expect(host.inert).toBe(true);
 await trocar("   ");expect(botao("Pausar a Aria").hasAttribute("disabled")).toBe(true);await clicar("Cancelar");
 expect(a.pausar).not.toHaveBeenCalled();expect(dialogo()).toBeNull();expect(doc.activeElement===trigger).toBe(true);
});
it("pausa trim, duplo clique único, ACK recarrega sem otimismo",async()=>{
 let resolver!:(r:{ok:true})=>void;a.pausar.mockImplementationOnce(()=>new Promise(r=>resolver=r));
 await montar();await clicar("Aria ativa");await trocar("  Revisão  ");
 await act(async()=>{eventos(botao("Pausar a Aria")).onClick();eventos(botao("Pausar a Aria")).onClick();});
 expect(a.pausar).toHaveBeenCalledExactlyOnceWith({motivo:"Revisão"});expect(mudar).not.toHaveBeenCalled();
 await act(async()=>resolver({ok:true}));expect(mudar).toHaveBeenCalledOnce();expect(dialogo()).toBeNull();
 expect(host.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("true");await montar({pausada:true});expect(host.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("false");
});
it("erro e transporte incerto preservam motivo para retry idêntico",async()=>{
 a.pausar.mockResolvedValueOnce({ok:false,erro:"Falha de regra"}).mockRejectedValueOnce(Error("rede"));await montar();await clicar("Aria ativa");await trocar("Revisão");await clicar("Pausar a Aria");
 expect(dialogo()?.textContent).toContain("Falha de regra");await clicar("Pausar a Aria");expect(dialogo()).not.toBeNull();await clicar("Pausar a Aria");expect(a.pausar).toHaveBeenNthCalledWith(3,{motivo:"Revisão"});expect(mudar).toHaveBeenCalledOnce();
});
it.each(["revogada","ciclo","desmonta"] as const)("ACK antigo não fecha nova abertura nem recarrega após %s",async caso=>{
 let resolver!:(r:{ok:true})=>void;a.pausar.mockImplementationOnce(()=>new Promise(r=>resolver=r));await montar();await clicar("Aria ativa");await trocar("x");await clicar("Pausar a Aria");
 if(caso==="desmonta")await act(async()=>root.render(null));else{await montar({podeGerenciar:false});if(caso==="ciclo"){await montar();await clicar("Aria ativa");}}
 await act(async()=>resolver({ok:true}));expect(mudar).not.toHaveBeenCalled();if(caso==="ciclo")expect(dialogo()).not.toBeNull();
});
it("reativar sem diálogo e somente ACK atual recarrega",async()=>{await montar({pausada:true});await clicar("Aria ativa");expect(a.reativar).toHaveBeenCalledOnce();expect(dialogo()).toBeNull();expect(mudar).toHaveBeenCalledOnce();});
it("Escape cancela, limite501 não dispara e campo recebe foco local",async()=>{
 await montar();await clicar("Aria ativa");expect(doc.activeElement===dialogo()!.querySelector("input")).toBe(true);
 await trocar("x".repeat(501));await clicar("Pausar a Aria");expect(a.pausar).not.toHaveBeenCalled();
 await act(async()=>{for(const k of [...keys])if(k.type==="keydown")k.fn({key:"Escape",stopPropagation(){},preventDefault(){}});});expect(dialogo()).toBeNull();
});
it("reativação pendente revogada não recarrega por ACK antigo",async()=>{
 let resolver!:(r:{ok:true})=>void;a.reativar.mockImplementationOnce(()=>new Promise(r=>resolver=r));await montar({pausada:true});await clicar("Aria ativa");await montar({pausada:true,podeGerenciar:false});await montar({pausada:true});await act(async()=>resolver({ok:true}));expect(mudar).not.toHaveBeenCalled();
});

it("/aria mantém retry idempotente no cabeçalho compartilhado após transporte incerto",async()=>{a.reativar.mockRejectedValueOnce(Error("rede"));await act(async()=>root.render(createElement(Cabecalho,{nome:"Aria",funcao:"Comercial",versaoPublicada:1,estado:"ATIVA",pausada:true,motivoPausa:"Revisão",supervisao:false,podeMudarEstado:false,podePausar:true,verProvedor:false})));await clicar("Reativar");expect(host.textContent).toContain(MSG_RESULTADO_INCERTO);await clicar("Reativar");expect(a.reativar).toHaveBeenCalledTimes(2);expect(a.refresh).toHaveBeenCalledOnce();});
