import { DriverWhatsApp } from "@prisma/client";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, Elemento, type Documento } from "@/test/dom-minimo";
import type { InboxNovo as Inbox, PropsInboxNovo } from "./InboxNovo";
vi.mock("next/navigation",()=>({useRouter:()=>({replace:vi.fn(),push:vi.fn()}),usePathname:()=>"/inbox"}));
vi.mock("./useEventosInbox",()=>({useEventosInbox:()=>({conectado:true})}));
vi.mock("@/components/conversa/useConversa",()=>({useConversa:()=>({mensagens:[]})}));
vi.mock("@/server/whatsapp/preferencias",()=>({marcarAtendimentoLido:async()=>({ok:true})}));
vi.mock("@/server/whatsapp/operacoes-atendimento",()=>({abrirAtendimentoInstitucional:vi.fn()}));
vi.mock("@/server/whatsapp/acoes",()=>({registrarOptOutContato:vi.fn(),removerOptOutContato:vi.fn(),enviarTextoInbox:vi.fn(),enviarMidiaInbox:vi.fn()}));
// Backend/thread não são objeto deste teste. Região real/Coluna/Popover/form/hook continuam reais.
vi.mock("./ConversaAberta",async()=>{const {createElement}=await import("react");return{ConversaAberta:()=>createElement("header",null,"Thread")};});
vi.mock("@tabler/icons-react",async()=>{const {createElement}=await import("react");const I=()=>createElement("span");return{IconFilter:I,IconEdit:I,IconSearch:I,IconX:I,IconChevronDown:I,IconCheck:I,IconDeviceMobile:I,IconSparkles:I,IconBellOff:I,IconClockExclamation:I,IconPin:I,IconUsersGroup:I,IconUserX:I};});
let doc:Documento,container:Elemento,root:Root,InboxNovo:typeof Inbox;
const ouvintes:{alvo:object;tipo:string;f:(e:Event)=>void;captura:boolean}[]=[];
function eventos(alvo:object){return{addEventListener(tipo:string,f:(e:Event)=>void,captura=false){ouvintes.push({alvo,tipo,f,captura});},removeEventListener(tipo:string,f:(e:Event)=>void){const i=ouvintes.findIndex(o=>o.alvo===alvo&&o.tipo===tipo&&o.f===f);if(i>=0)ouvintes.splice(i,1);}};}
const item={id:"a1",numeroId:"n1",numeroRotulo:"Central",finalidade:"COMERCIAL",driver:DriverWhatsApp.META_CLOUD,contatoId:"c1",contatoNome:"Ana",contatoTelefone:"+5500000000301",optOut:false,vinculo:null,naoLidas:0,ultimaMensagemEm:null,preview:"Oi",linhaComercial:false,status:"EM_ATENDIMENTO",responsavelNome:null,prazoRespostaEm:null,fixada:false,silenciada:false,grupo:false,responsavelId:null,numeroDonoId:null,setoresDoNumero:["COMERCIAL"],atendimentoOrigemId:null,capacidades:[]};
const props={inicial:{itens:[item],proximo:null},filtros:{},selecionado:null,usuario:{id:"u1",papeis:["VENDEDOR"]},fuso:null,opcoesNovaConversa:{destinos:[],numeros:[],comercial:true}} as PropsInboxNovo;
beforeEach(async()=>{const dom=criarDomMinimo();doc=dom.documento;ouvintes.length=0;Object.assign(doc,eventos(doc),{visibilityState:"visible",querySelector:(s:string)=>doc.body.querySelector(s)});Object.assign(dom.janela,eventos(dom.janela),{innerWidth:390,matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})});vi.stubGlobal("window",dom.janela);vi.stubGlobal("document",doc);vi.stubGlobal("MutationObserver",dom.MutationObserver);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.stubGlobal("fetch",vi.fn(async()=>new Response(null,{status:404})));container=doc.createElement("div");doc.body.appendChild(container);Object.assign(container,eventos(container));
 // Geometria explícita do DOM mínimo; CSS390 real será validado no browser coordenado.
 Object.defineProperty(Elemento.prototype,"options",{configurable:true,get:function(this:Elemento){return this.querySelectorAll("option");}});
 Object.defineProperty(Elemento.prototype,"getClientRects",{configurable:true,value:function(this:Elemento){if(this.getAttribute("aria-label")==="Conversa")return container.querySelector('[data-vista="conversa"]')?[{}]:[];return[{}];}});
 const {createRoot}=await import("react-dom/client");({InboxNovo}=await import("./InboxNovo"));root=createRoot(container as unknown as HTMLElement);
});
afterEach(async()=>{if(root)await act(async()=>root.unmount());delete (Elemento.prototype as unknown as {getClientRects?:unknown}).getClientRects;delete (Elemento.prototype as unknown as {options?:unknown}).options;desligarObservadores();vi.unstubAllGlobals();});
const rotulo=(n:string)=>container.querySelector('[aria-label="'+n+'"]')!;
async function render(p:PropsInboxNovo){await act(async()=>root.render(createElement(InboxNovo,p)));}
async function evento(tipo:string,alvo:Elemento,extra:Record<string,unknown>={}){let parar=false;const e={type:tipo,target:alvo,button:0,bubbles:true,preventDefault(){},stopPropagation(){parar=true;},...extra};await act(async()=>{for(const objeto of [container,doc])for(const captura of [true,false])for(const o of [...ouvintes])if(!parar&&o.alvo===objeto&&o.tipo===tipo&&o.captura===captura)o.f(e as unknown as Event);});}
it("navegação recebida fechaNovo e foca regiãoConversa, nunca o gatilho na coluna que se oculta",async()=>{
 await render(props);const gatilho=rotulo("Nova conversa");gatilho.focus();await evento("click",gatilho);expect(container.querySelector('[role="dialog"]')).not.toBeNull();const spy=vi.spyOn(gatilho,"focus");
 await render({...props,selecionado:"a1"});expect(container.querySelector('[role="dialog"]')).toBeNull();expect(doc.activeElement===rotulo("Conversa")).toBe(true);expect(spy).not.toHaveBeenCalled();expect(container.querySelector('[data-vista="conversa"]')).not.toBeNull();
});
it("CtrlK naNova controlada peloInbox termina no campo real e mantém somente um formulárioNovo",async()=>{
 await render(props);const gatilho=rotulo("Nova conversa");gatilho.focus();await evento("click",gatilho);const modal=container.querySelector('[role="dialog"]')!;expect(modal.querySelectorAll('form')).toHaveLength(1);await evento("keydown",rotulo("Fechar"),{key:"k",ctrlKey:true,metaKey:false});expect(container.querySelector('[role="dialog"]')).toBeNull();expect(doc.activeElement===rotulo("Buscar conversas")).toBe(true);
});
