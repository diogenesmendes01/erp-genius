import { DriverWhatsApp } from "@prisma/client";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, Elemento, type Documento } from "@/test/dom-minimo";
import type { InboxNovo as Inbox, PropsInboxNovo } from "./InboxNovo";
const rota313=vi.hoisted(()=>({busca:null as string|null}));
vi.mock("next/navigation",()=>({useRouter:()=>({replace:vi.fn(),push:vi.fn()}),usePathname:()=>"/inbox",useSearchParams:()=>rota313.busca===null?null:new URLSearchParams(rota313.busca)}));
vi.mock("./useEventosInbox",()=>({useEventosInbox:()=>({conectado:true})}));
vi.mock("@/components/conversa/useConversa",()=>({useConversa:()=>({mensagens:[]})}));
vi.mock("@/server/whatsapp/preferencias",()=>({marcarAtendimentoLidoAutomatico:async()=>({ok:true})}));
vi.mock("@/server/whatsapp/operacoes-atendimento",()=>({abrirAtendimentoInstitucional:vi.fn()}));
vi.mock("@/server/whatsapp/acoes",()=>({registrarOptOutContato:vi.fn(),removerOptOutContato:vi.fn(),enviarTextoInbox:vi.fn(),enviarMidiaInbox:vi.fn()}));
// Backend/thread não são objeto deste teste. Região real/Coluna/Popover/form/hook continuam reais.
vi.mock("./ConversaAberta",async()=>{const {createElement}=await import("react");return{ConversaAberta:({aoVoltar,aoAlternarPainel}:{aoVoltar():void;aoAlternarPainel():void})=>createElement("header",null,createElement("button",{"aria-label":"Voltar para a lista",onClick:aoVoltar},"Voltar"),createElement("button",{"aria-label":"Painel do contato","aria-controls":"painel-contato",onClick:aoAlternarPainel},"Painel"))};});
vi.mock("@tabler/icons-react",async()=>{const {createElement}=await import("react");const I=()=>createElement("span");return{IconMail:I,IconMapPin:I,IconSpeakerphone:I,IconSchool:I,IconBuilding:I,IconId:I,IconLink:I,IconUser:I,IconUsers:I,IconBriefcase:I,IconChevronRight:I,IconMessages:I,IconPhone:I,IconPencil:I,IconChevronLeft:I,IconFilter:I,IconEdit:I,IconSearch:I,IconX:I,IconChevronDown:I,IconCheck:I,IconDeviceMobile:I,IconSparkles:I,IconBellOff:I,IconClockExclamation:I,IconPin:I,IconUsersGroup:I,IconUserX:I};});
let doc:Documento,container:Elemento,root:Root,InboxNovo:typeof Inbox;
let largura=390;const medias=new Set<()=>void>();
const ouvintes:{alvo:object;tipo:string;f:(e:Event)=>void;captura:boolean}[]=[];
function eventos(alvo:object){return{addEventListener(tipo:string,f:(e:Event)=>void,captura=false){ouvintes.push({alvo,tipo,f,captura});},removeEventListener(tipo:string,f:(e:Event)=>void){const i=ouvintes.findIndex(o=>o.alvo===alvo&&o.tipo===tipo&&o.f===f);if(i>=0)ouvintes.splice(i,1);}};}
const item={estadoAria:null,atendidoPorVoce:false,previaAutor:null,previaRotulo:null,id:"a1",numeroId:"n1",numeroRotulo:"Central",finalidade:"COMERCIAL",driver:DriverWhatsApp.META_CLOUD,contatoId:"c1",contatoNome:"Ana",contatoTelefone:"+5500000000301",optOut:false,vinculo:null,naoLidas:0,ultimaMensagemEm:null,preview:"Oi",linhaComercial:false,status:"EM_ATENDIMENTO",responsavelNome:null,prazoRespostaEm:null,fixada:false,silenciada:false,grupo:false,responsavelId:null,numeroDonoId:null,setoresDoNumero:["COMERCIAL"],atendimentoOrigemId:null,capacidades:[]};
const props={inicial:{itens:[item],proximo:null},filtros:{},selecionado:null,usuario:{id:"u1",papeis:["VENDEDOR"]},fuso:null,opcoesNovaConversa:{destinos:[],numeros:[],comercial:true}} as PropsInboxNovo;
beforeEach(async()=>{rota313.busca=null;largura=390;medias.clear();const dom=criarDomMinimo();doc=dom.documento;ouvintes.length=0;Object.assign(doc,eventos(doc),{visibilityState:"visible",querySelector:(s:string)=>doc.body.querySelector(s),querySelectorAll:(s:string)=>doc.body.querySelectorAll(s)});Object.assign(dom.janela,eventos(dom.janela),{innerWidth:390,matchMedia:(consulta:string)=>({get matches(){return largura>=Number(consulta.match(/\d+/)?.[0]);},addEventListener(_tipo:string,f:()=>void){medias.add(f);},removeEventListener(_tipo:string,f:()=>void){medias.delete(f);}})});vi.stubGlobal("window",dom.janela);vi.stubGlobal("document",doc);vi.stubGlobal("MutationObserver",dom.MutationObserver);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.stubGlobal("fetch",vi.fn(async()=>new Response(null,{status:404})));container=doc.createElement("div");doc.body.appendChild(container);Object.assign(container,eventos(container));
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
it("seleção local fechaNova antes de ocultar coluna e devolve foco à conversa visível sem listener residual",async()=>{
 await render(props);const gatilho=rotulo("Nova conversa");const atalhos=ouvintes.filter(o=>o.tipo==="keydown").length;gatilho.focus();await evento("click",gatilho);expect(container.querySelector('[role="dialog"]')).not.toBeNull();const focoGatilho=vi.spyOn(gatilho,"focus");
 const linha=rotulo("Conversas").querySelectorAll("button").find(e=>e.textContent?.includes("Ana"))!;expect(linha).toBeTruthy();await evento("click",linha);
 expect(container.querySelector('[data-vista="conversa"]')).not.toBeNull();expect(container.querySelector('[role="dialog"]')).toBeNull();expect(doc.activeElement===rotulo("Conversa")).toBe(true);expect(focoGatilho).not.toHaveBeenCalled();expect(ouvintes.filter(o=>o.tipo==="keydown")).toHaveLength(atalhos);
});
it.each(["Filtros","Todos os números · 1 conectado"])("seleção local desmonta %s, inclusive ao reabrir a mesma conversa",async(gatilhoNome)=>{
 const p={...props,opcoesFiltro:{setores:["COMERCIAL"],numeros:[{id:"n1",rotulo:"Central",saude:"conectado"}]}} as PropsInboxNovo;
 await render(p);const atalhos=ouvintes.filter(o=>o.tipo==="keydown").length;
 for(let rodada=0;rodada<2;rodada++){
  if(rodada)await evento("click",rotulo("Voltar para a lista"));const gatilho=rotulo(gatilhoNome);gatilho.focus();await evento("click",gatilho);expect(container.querySelector('[role="dialog"]')!==null).toBe(true);const spy=vi.spyOn(gatilho,"focus");
  const linha=rotulo("Conversas").querySelectorAll("button").find(e=>e.textContent?.includes("Ana"))!;await evento("click",linha);expect(container.querySelector('[role="dialog"]')===null).toBe(true);expect(doc.activeElement===rotulo("Conversa")).toBe(true);expect(spy).not.toHaveBeenCalled();expect(ouvintes.filter(o=>o.tipo==="keydown")).toHaveLength(atalhos);spy.mockRestore();
 }
});
it.each(["Filtros","Todos os números · 1 conectado"])("navegação recebida com %s aberto fecha e foca a nova conversa",async(gatilhoNome)=>{
 const p={...props,opcoesFiltro:{setores:["COMERCIAL"],numeros:[{id:"n1",rotulo:"Central",saude:"conectado"}]}} as PropsInboxNovo;
 await render(p);await evento("click",rotulo(gatilhoNome));expect(container.querySelector('[role="dialog"]')!==null).toBe(true);await render({...p,selecionado:"a1"});expect(container.querySelector('[role="dialog"]')===null).toBe(true);expect(doc.activeElement===rotulo("Conversa")).toBe(true);
});
it("snapshot que confirma seleção local preserva Nova e seu retorno de foco ao gatilho",async()=>{
 await render(props);const linha=rotulo("Conversas").querySelectorAll("button").find(e=>e.textContent?.includes("Ana"))!;await evento("click",linha);await evento("click",rotulo("Voltar para a lista"));const gatilho=rotulo("Nova conversa");gatilho.focus();await evento("click",gatilho);await render({...props,selecionado:"a1"});expect(container.querySelector('[role="dialog"]')!==null).toBe(true);expect(container.querySelector('[data-vista="lista"]')!==null).toBe(true);await evento("keydown",rotulo("Fechar"),{key:"Escape"});expect(doc.activeElement===gatilho).toBe(true);
});
it("URL pública c→null fechaNova com propSSRnull igual e retorna foco à busca real",async()=>{
 rota313.busca="";const local={href:"http://localhost/inbox"};Object.assign(window,{location:local,history:{replaceState(_d:unknown,_t:string,url:string|URL){local.href=String(url);rota313.busca=new URL(local.href).search.slice(1);}}});await render(props);
 const linha=rotulo("Conversas").querySelectorAll("button").find(e=>e.textContent?.includes("Ana"))!;await evento("click",linha);await evento("click",rotulo("Voltar para a lista"));const gatilho=rotulo("Nova conversa");gatilho.focus();await evento("click",gatilho);expect(rota313.busca).toBe("c=a1");rota313.busca="";await render(props);expect(container.querySelector('[role="dialog"]')===null).toBe(true);expect(container.querySelector('[data-vista="lista"]')!==null).toBe(true);expect(doc.activeElement===rotulo("Buscar conversas")).toBe(true);
});

const resumo326={setor:"COMERCIAL",podeEnviar:false,oportunidade:null,tags:[],cabecalho:{pessoaId:"p326",tagsDisponiveis:[],semNome:false,capacidades:{editarContato:true,editarTags:false,criarTag:false,verContato:true}},acoes:{contatoId:"c1",contatoNome:"Mariana fictícia",nomeSalvo:"Mariana fictícia",nomePerfil:null,fonteNome:"contato",alunoId:null,leadId:null,podeCriarLead:false,podeVincular:false,podeEditarNome:false,vinculos:[],cobranca:null}};
const detalhes326={pessoa:{id:"p326",nome:"Mariana fictícia",email:null,cidade:null,cargo:null,linkedin:null,origemCanal:null,telefone:"+5500000000326",empresa:null},oportunidade:null,b2b:null,campos:[]};
function instalarLeitura326(){vi.mocked(fetch).mockImplementation(async url=>new Response(JSON.stringify(String(url).endsWith('/painel/detalhes')?detalhes326:String(url).endsWith('/painel')?resumo326:{itens:[item],proximo:null}),{status:200}));}
async function resize326(n:number){await act(async()=>{largura=n;Object.assign(window,{innerWidth:n});for(const f of [...medias])f();});}
it("326:390→1024→390 mantém rascunho e Escape retorna ao controle atual quando o lápis fica oculto",async()=>{
 instalarLeitura326();await render({...props,selecionado:"a1"});await evento("click",rotulo("Painel do contato"));await evento("click",rotulo("Editar contato"));
 const nome=container.querySelector('[name="nome"]')! as Elemento&{value:string};expect(nome).toBeTruthy();
 const chave=Object.keys(nome).find(k=>k.startsWith('__reactProps'))!;await act(async()=>{(nome as unknown as Record<string,{onChange(e:unknown):void}>)[chave].onChange({target:{value:"Rascunho local326"}});});
 await resize326(1024);await resize326(390);expect(container.querySelector('[name="nome"]')===nome).toBe(true);expect(nome.value).toBe("Rascunho local326");
 expect(container.querySelectorAll('[aria-modal="true"]')).toHaveLength(1);await evento("keydown",rotulo("Fechar"),{key:"Escape"});
 expect(container.querySelector('aside[aria-label="Editar contato"]')).toBeNull();expect(doc.activeElement===rotulo("Painel do contato")).toBe(true);expect(doc.activeElement.closest('[inert]')).toBeNull();
});
it("326: fechar semresize mantém foco já restaurado pelo painel, sem roubar para outro gatilho",async()=>{
 instalarLeitura326();await render({...props,selecionado:"a1"});await evento("click",rotulo("Painel do contato"));await evento("click",rotulo("Editar contato"));
 await evento("keydown",rotulo("Fechar"),{key:"Escape"});
 expect(doc.activeElement===rotulo("Fechar painel do contato")).toBe(true);expect(doc.activeElement.closest('[inert]')).toBeNull();
});
