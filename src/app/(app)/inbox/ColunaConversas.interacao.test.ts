import { act, createElement, useState } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Documento, type Elemento } from "@/test/dom-minimo";
import type { ColunaConversas as Coluna, PropsColunaConversas } from "./ColunaConversas";
const replace=vi.hoisted(()=>vi.fn());
vi.mock("next/navigation",()=>({useRouter:()=>({replace}),usePathname:()=>"/inbox"}));
// O DOM mínimo não oferece SVG; só decoração é substituída. React, diálogos, filtros e URLs são reais.
vi.mock("@tabler/icons-react",async()=>{const {createElement}=await import("react");const I=()=>createElement("span");return{IconFilter:I,IconEdit:I,IconSearch:I,IconX:I,IconChevronDown:I,IconCheck:I,IconDeviceMobile:I,IconSparkles:I,IconBellOff:I,IconClockExclamation:I,IconPin:I,IconUsersGroup:I,IconUserX:I};});
let doc:Documento,container:Elemento,root:Root,ColunaConversas:typeof Coluna;
const ouvintes:{alvo:object;tipo:string;f:(e:Event)=>void;captura:boolean}[]=[];
function eventos(alvo:object){return{addEventListener(tipo:string,f:(e:Event)=>void,captura=false){ouvintes.push({alvo,tipo,f,captura});},removeEventListener(tipo:string,f:(e:Event)=>void){const i=ouvintes.findIndex(o=>o.alvo===alvo&&o.tipo===tipo&&o.f===f);if(i>=0)ouvintes.splice(i,1);}};}
async function disparar(tipo:string,alvo:Elemento,extra:Record<string,unknown>={}){let parado=false;const e={type:tipo,target:alvo,button:0,bubbles:true,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){parado=true;},...extra};await act(async()=>{for(const objeto of [container,doc])for(const captura of [true,false])for(const o of [...ouvintes])if(!parado&&o.alvo===objeto&&o.tipo===tipo&&o.captura===captura)o.f(e as unknown as Event);});return e;}
const botao=(texto:string)=>container.querySelectorAll('button').find(b=>b.textContent===texto)!;
const rotulo=(r:string)=>container.querySelector('[aria-label="'+r+'"]')!;
const dialogo=()=>container.querySelector('[role="dialog"]');
const props:PropsColunaConversas={filtros:{numeroId:"n1",busca:"ana",responsavel:"eu",naoLidas:true},opcoesFiltro:{setores:["COMERCIAL","FINANCEIRO"],numeros:[{id:"n1",rotulo:"Central",saude:"conectado"},{id:"n2",rotulo:"Secretaria",saude:"instavel"}]},itens:[],proximo:null,selecionado:null,aoSelecionar(){},aoCarregarMais(){},aoNovaConversa(){},novaConversa:createElement("input",{"aria-label":"Campo Nova"}),usuarioId:"u1",podeGerenciarNumeros:false,fuso:null};
beforeEach(async()=>{const dom=criarDomMinimo();doc=dom.documento;ouvintes.length=0;replace.mockClear();Object.assign(doc,eventos(doc),{querySelector:(s:string)=>doc.body.querySelector(s)});Object.assign(dom.janela,eventos(dom.janela));vi.stubGlobal("document",doc);vi.stubGlobal("window",dom.janela);vi.stubGlobal("MutationObserver",dom.MutationObserver);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);const {createRoot}=await import("react-dom/client");({ColunaConversas}=await import("./ColunaConversas"));container=doc.createElement("div");doc.body.appendChild(container);Object.assign(container,eventos(container));root=createRoot(container as unknown as HTMLElement);});
afterEach(async()=>{if(root)await act(async()=>root.unmount());desligarObservadores();vi.unstubAllGlobals();});
async function montar(extra:Partial<PropsColunaConversas>={}){await act(async()=>root.render(createElement(ColunaConversas,{...props,...extra})));}
it("aplicar, Limpar e remover setor/status navegam URL real preservando outros filtros",async()=>{
 await montar({filtros:{...props.filtros,setor:"COMERCIAL",status:"ENCERRADO"}});
 await disparar("click",rotulo("Filtros"));await disparar("click",botao("Financeiro"));await disparar("click",botao("Mostrar conversas"));
 expect(replace).toHaveBeenLastCalledWith("/inbox?setor=FINANCEIRO&numero=n1&resp=eu&status=ENCERRADO&naoLidas=1&busca=ana");expect(dialogo()).toBeNull();
 await disparar("click",rotulo("Filtros"));await disparar("click",botao("Limpar"));expect(replace).toHaveBeenLastCalledWith("/inbox?numero=n1&resp=eu&naoLidas=1&busca=ana");
 await disparar("click",rotulo("Remover filtro Comercial"));expect(replace).toHaveBeenLastCalledWith("/inbox?numero=n1&resp=eu&status=ENCERRADO&naoLidas=1&busca=ana");
 await disparar("click",rotulo("Remover filtro Encerrado"));expect(replace).toHaveBeenLastCalledWith("/inbox?setor=COMERCIAL&numero=n1&resp=eu&naoLidas=1&busca=ana");
});
it("chip e seletor usam a mesma URL, sem perder setor/status/busca nem criar segunda consulta",async()=>{
 await montar({filtros:{setor:"FINANCEIRO",status:"ENCERRADO",busca:"ana",naoLidas:true}});
 await disparar("click",botao("Minhas0"));expect(replace).toHaveBeenLastCalledWith("/inbox?setor=FINANCEIRO&resp=eu&status=ENCERRADO&busca=ana");
 await disparar("click",rotulo("Todos os números · 1 conectado"));await disparar("click",botao("SecretariaInstável"));expect(replace).toHaveBeenLastCalledWith("/inbox?setor=FINANCEIRO&numero=n2&status=ENCERRADO&naoLidas=1&busca=ana");expect(dialogo()).toBeNull();
});
it("dialog não-modal mantém gatilho ativo; trap/ShiftTab/Escape devolvem foco",async()=>{
 await montar();const gatilho=rotulo("Filtros");gatilho.focus();await disparar("click",gatilho);expect(doc.activeElement===rotulo("Fechar")).toBe(true);expect(gatilho.hasAttribute("disabled")).toBe(false);expect(dialogo()?.hasAttribute("aria-modal")).toBe(false);
 const mostrar=botao("Mostrar conversas");mostrar.focus();await disparar("keydown",mostrar,{key:"Tab",shiftKey:false});expect(doc.activeElement===rotulo("Fechar")).toBe(true);
 await disparar("keydown",rotulo("Fechar"),{key:"Tab",shiftKey:true});expect(doc.activeElement===mostrar).toBe(true);
 await disparar("keydown",mostrar,{key:"Escape"});expect(dialogo()).toBeNull();expect(doc.activeElement===gatilho).toBe(true);
});
it("CtrlK fecha qualquer popover e foca busca depois do cleanup de retorno",async()=>{
 await montar();for(const label of ["Filtros","Central","Nova conversa"]){const gatilho=rotulo(label);gatilho.focus();await disparar("click",gatilho);expect(dialogo()).not.toBeNull();await disparar("keydown",rotulo("Fechar"),{key:"k",ctrlKey:true,metaKey:false});expect(dialogo()).toBeNull();expect(doc.activeElement===rotulo("Buscar conversas")).toBe(true);}
});
it("modo controlado Nova possui dono externo único e CtrlK fecha sem roubar foco da busca",async()=>{
 function Tela(){const [aberto,setAberto]=useState(false);return createElement(ColunaConversas,{...props,novaConversaAberta:aberto,aoNovaConversa:()=>setAberto(true),aoFecharNovaConversa:()=>setAberto(false)});}
 await act(async()=>root.render(createElement(Tela)));const gatilho=rotulo("Nova conversa");gatilho.focus();await disparar("click",gatilho);expect(dialogo()?.getAttribute("aria-label")).toBe("Nova conversa");await disparar("keydown",rotulo("Fechar"),{key:"K",metaKey:true,ctrlKey:false});expect(dialogo()).toBeNull();expect(doc.activeElement===rotulo("Buscar conversas")).toBe(true);
});
it("substituir popover preserva sóum e desmontar limpa atalho sem capturar eventos futuros",async()=>{
 await montar();await disparar("click",rotulo("Filtros"));await disparar("click",rotulo("Central"));expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1);expect(dialogo()?.getAttribute("aria-label")).toBe("Ver conversas de");
 await act(async()=>root.unmount());expect(ouvintes.filter(o=>o.alvo===doc&&o.tipo==="keydown")).toHaveLength(0);const {createRoot}=await import("react-dom/client");root=createRoot(container as unknown as HTMLElement);
});
