import { DriverWhatsApp } from "@prisma/client";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, Elemento } from "@/test/dom-minimo";
import type { AvisoInbox } from "@/server/inbox/barramento";
import type { PropsInboxNovo, InboxNovo as Inbox } from "./InboxNovo";
import type { FonteHistorico } from "@/components/conversa/historico-conversa";

const m=vi.hoisted(()=>({
  receber:null as ((a:AvisoInbox)=>void)|null,
  observado:null as AvisoInbox|null,
  pagina:vi.fn<FonteHistorico["pagina"]>(),
  marcar:vi.fn(async()=>({ok:true})),
}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn(),replace:vi.fn()}),useSearchParams:()=>null,usePathname:()=>"/inbox"}));
vi.mock("./useEventosInbox",()=>({useEventosInbox:(f:(a:AvisoInbox)=>void)=>{m.receber=f;return{conectado:true};}}));
vi.mock("@/components/conversa/fonte-erp",()=>({fonteErp:{pagina:m.pagina}}));
vi.mock("@/components/conversa/useConversa",async original=>{
  const real=await original<typeof import("@/components/conversa/useConversa")>();
  return{useConversa:function useConversa(id:string|null,aviso:AvisoInbox|null){m.observado=aviso;return real.useConversa(id,aviso);}};
});
vi.mock("@/server/whatsapp/preferencias",()=>({marcarAtendimentoLidoAutomatico:m.marcar}));
vi.mock("@/server/whatsapp/operacoes-atendimento",()=>({abrirAtendimentoInstitucional:vi.fn()}));
vi.mock("@/server/whatsapp/acoes",()=>({registrarOptOutContato:vi.fn(),removerOptOutContato:vi.fn(),enviarTextoInbox:vi.fn(),enviarMidiaInbox:vi.fn()}));
vi.mock("./ConversaAberta",async()=>{const {createElement}=await import("react");return{ConversaAberta:()=>createElement("header",null,"Thread teste345")};});
vi.mock("@tabler/icons-react",async()=>{const {createElement}=await import("react"),I=()=>createElement("span");return{IconMessages:I,IconPhone:I,IconChevronLeft:I,IconFilter:I,IconEdit:I,IconSearch:I,IconX:I,IconChevronDown:I,IconCheck:I,IconDeviceMobile:I,IconSparkles:I,IconBellOff:I,IconClockExclamation:I,IconPin:I,IconUsersGroup:I,IconUserX:I};});

const item={id:"a1",numeroId:"n1",numeroRotulo:"Fake345",finalidade:"COMERCIAL",driver:DriverWhatsApp.MOTOR,contatoId:"ct1",contatoNome:"Ana",contatoTelefone:"+50600000345",optOut:false,vinculo:null,naoLidas:0,ultimaMensagemEm:null,preview:"",linhaComercial:false,status:"EM_ATENDIMENTO",responsavelNome:null,prazoRespostaEm:null,fixada:false,silenciada:false,grupo:false,responsavelId:null,numeroDonoId:null,setoresDoNumero:["COMERCIAL"],atendimentoOrigemId:null,capacidades:[],estadoAria:null,atendidoPorVoce:false,previaAutor:null,previaRotulo:null};
const props={inicial:{itens:[item],proximo:null},filtros:{busca:"Ana"},selecionado:"a1",usuario:{id:"u345",papeis:["VENDEDOR"]},fuso:null} as PropsInboxNovo;
const global345:AvisoInbox={tipo:"aria.global",atendimentoId:null,mensagemId:null,conversaId:""};
const nova345:AvisoInbox={tipo:"mensagem.nova",atendimentoId:"a1",mensagemId:"m2",conversaId:"cv1"};
let root:Root|undefined,InboxNovo:typeof Inbox;
const fetcher=vi.fn<typeof fetch>();
const paineis=()=>fetcher.mock.calls.filter(([url])=>String(url).endsWith("/painel"));
const listas=()=>fetcher.mock.calls.filter(([url])=>String(url).startsWith("/api/inbox/atendimentos?"));

beforeEach(async()=>{
  vi.clearAllMocks();m.receber=null;m.observado=null;
  const dom=criarDomMinimo(),doc=dom.documento;
  Object.assign(doc,{visibilityState:"visible",addEventListener(){},removeEventListener(){},querySelector:(s:string)=>doc.body.querySelector(s)});
  Object.assign(dom.janela,{innerWidth:1440,addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})});
  vi.stubGlobal("window",dom.janela);vi.stubGlobal("document",doc);vi.stubGlobal("MutationObserver",dom.MutationObserver);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
  Object.defineProperty(Elemento.prototype,"getClientRects",{configurable:true,value:()=>[{}]});
  Object.defineProperty(Elemento.prototype,"options",{configurable:true,get:function(this:Elemento){return this.querySelectorAll("option");}});
  m.pagina.mockImplementation(async(_id,o)=>({mensagens:o.depois?[]:[{id:"m1",direcao:"ENTRADA",tipo:"TEXTO",corpo:"Fixture345",midiaPath:null,status:"RECEBIDA",origem:null,autorNome:null,templateNome:null,criadoEm:"2026-10-25T00:00:00.000Z",participanteNome:null,favorita:false,clientMessageId:null}],notas:[],antes:"c1",depois:"c1",temMais:false}));
  fetcher.mockImplementation(async url=>{
    if(String(url).endsWith("/painel/detalhes"))return new Response(JSON.stringify({pessoa:null,oportunidade:null,b2b:null,campos:[]}));
    if(String(url).endsWith("/painel"))return new Response(JSON.stringify({setor:"COMERCIAL",oportunidade:null,pessoaId:null,podeEnviar:false,aria:null,acoes:null}));
    if(String(url).startsWith("/api/inbox/atendimentos?"))return new Response(JSON.stringify(props.inicial));
    throw Error("ROTA_NAO_PREVISTA_345");
  });
  vi.stubGlobal("fetch",fetcher);
  const {createRoot}=await import("react-dom/client");({InboxNovo}=await import("./InboxNovo"));
  const container=doc.createElement("div");Object.assign(container,{addEventListener(){},removeEventListener(){}});doc.body.appendChild(container);root=createRoot(container as unknown as HTMLElement);
  vi.useFakeTimers({toFake:["setTimeout","clearTimeout"]});
  await act(async()=>{root!.render(createElement(InboxNovo,props));});
  await act(async()=>{await vi.advanceTimersByTimeAsync(50);});
  fetcher.mockClear();m.pagina.mockClear();m.marcar.mockClear();
});
afterEach(async()=>{
  if(root)await act(async()=>root!.unmount());root=undefined;
  vi.clearAllTimers();vi.useRealTimers();delete(Elemento.prototype as unknown as {getClientRects?:unknown}).getClientRects;delete(Elemento.prototype as unknown as {options?:unknown}).options;
  desligarObservadores();vi.unstubAllGlobals();
});
async function emitir(...avisos:AvisoInbox[]){await act(async()=>{for(const a of avisos)m.receber!(a);});await act(async()=>{await vi.advanceTimersByTimeAsync(50);});}

// ReactDOM/useConversa/Historico são reais. Só a fonte de dados/ações e geometria DOM são fakes; não é prova visual/browser.
it("global isolado invalida lista/painel sem tocar aviso/thread ou leitura",async()=>{
  await emitir(global345);expect(m.observado).toBeNull();expect(m.pagina).not.toHaveBeenCalled();expect(m.marcar).not.toHaveBeenCalled();expect(paineis()).toHaveLength(1);expect(listas()).toHaveLength(1);expect(String(listas()[0][0])).toContain("contagens=1");expect(String(listas()[0][0])).toContain("busca=Ana");
});
it.each([false,true])("mensagem e global no MESMO act mantêm o aviso da thread, globalPrimeiro=%s",async(globalPrimeiro)=>{
  await emitir(...(globalPrimeiro?[global345,nova345]:[nova345,global345]));expect(m.observado).toBe(nova345);expect(m.pagina).toHaveBeenCalledTimes(1);expect(m.pagina.mock.calls[0][1]).toEqual({depois:"c1"});expect(paineis()).toHaveLength(1);expect(listas()).toHaveLength(1);
});
it("resync seguido de global no mesmo act mantém recarga completa",async()=>{
  const resync:AvisoInbox={tipo:"resync",atendimentoId:null,mensagemId:null,conversaId:""};await emitir(resync,global345);expect(m.observado).toBe(resync);expect(m.pagina).toHaveBeenCalledTimes(1);expect(m.pagina.mock.calls[0][1]).toEqual({});
});
it("duas invalidações globais no mesmo act coalescem sem efeito de thread",async()=>{
  await emitir(global345,{...global345});expect(m.pagina).not.toHaveBeenCalled();expect(m.marcar).not.toHaveBeenCalled();expect(paineis()).toHaveLength(1);expect(listas()).toHaveLength(1);
});
