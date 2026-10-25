import { DriverWhatsApp } from "@prisma/client";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, Elemento } from "@/test/dom-minimo";
import type { AvisoInbox } from "@/server/inbox/barramento";
import type { PropsInboxNovo, InboxNovo as Inbox } from "./InboxNovo";
import type { FonteHistorico } from "@/components/conversa/historico-conversa";

const m=vi.hoisted(()=>({
  aoMudarFaixa:null as (()=>void)|null,
  receber:null as ((a:AvisoInbox)=>void)|null,
  observado:null as AvisoInbox|null,
  bloqueioRecebido:undefined as boolean|undefined,
  leituraRecebida:undefined as import("./aria/useHandoffConversa").LeituraPainelHandoff|undefined,
  ariaRecebida:null as import("@/server/whatsapp/consultas-inbox").AriaDoAtendimento|null|undefined,
  pagina:vi.fn<FonteHistorico["pagina"]>(),
  marcar:vi.fn(async()=>({ok:true})),
}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn(),replace:vi.fn()}),useSearchParams:()=>null,usePathname:()=>"/inbox"}));
vi.mock("./aria/FaixaAriaAtiva",async original=>{const real=await original<typeof import("./aria/FaixaAriaAtiva")>();return{FaixaAriaAtiva:(p:Parameters<typeof real.FaixaAriaAtiva>[0])=>{m.aoMudarFaixa=p.aoMudar??null;return createElement(real.FaixaAriaAtiva,p);}};});
vi.mock("./useEventosInbox",()=>({useEventosInbox:(f:(a:AvisoInbox)=>void)=>{m.receber=f;return{conectado:true};}}));
vi.mock("@/components/conversa/fonte-erp",()=>({fonteErp:{pagina:m.pagina}}));
vi.mock("@/components/conversa/useConversa",async original=>{
  const real=await original<typeof import("@/components/conversa/useConversa")>();
  return{useConversa:function useConversa(id:string|null,aviso:AvisoInbox|null){m.observado=aviso;return real.useConversa(id,aviso);}};
});
vi.mock("@/server/whatsapp/preferencias",()=>({marcarAtendimentoLidoAutomatico:m.marcar}));
vi.mock("@/server/whatsapp/operacoes-atendimento",()=>({abrirAtendimentoInstitucional:vi.fn()}));
vi.mock("@/server/whatsapp/acoes",()=>({registrarOptOutContato:vi.fn(),removerOptOutContato:vi.fn(),enviarTextoInbox:vi.fn(),enviarMidiaInbox:vi.fn()}));
vi.mock("./ConversaAberta",async()=>{const {createElement}=await import("react");return{ConversaAberta:(p:import("./ConversaAberta").PropsConversaAberta)=>{m.ariaRecebida=p.aria;m.leituraRecebida=p.leituraPainel;m.bloqueioRecebido=p.bloquearDecisoesAria;return createElement("header",null,"Thread teste345");}};});
vi.mock("@tabler/icons-react",async()=>{const {createElement}=await import("react"),I=()=>createElement("span");return{IconMessageCircle:I,IconMail:I,IconCalendar:I,IconCircleDot:I,IconMessages:I,IconPhone:I,IconChevronLeft:I,IconFilter:I,IconEdit:I,IconSearch:I,IconX:I,IconChevronDown:I,IconCheck:I,IconDeviceMobile:I,IconSparkles:I,IconBellOff:I,IconClockExclamation:I,IconPin:I,IconUsersGroup:I,IconUserX:I};});

const item={id:"a1",numeroId:"n1",numeroRotulo:"Fake345",finalidade:"COMERCIAL",driver:DriverWhatsApp.MOTOR,contatoId:"ct1",contatoNome:"Ana",contatoTelefone:"+50600000345",optOut:false,vinculo:null,naoLidas:0,ultimaMensagemEm:null,preview:"",linhaComercial:false,status:"EM_ATENDIMENTO",responsavelNome:null,prazoRespostaEm:null,fixada:false,silenciada:false,grupo:false,responsavelId:null,numeroDonoId:null,setoresDoNumero:["COMERCIAL"],atendimentoOrigemId:null,capacidades:[],estadoAria:null,atendidoPorVoce:false,previaAutor:null,previaRotulo:null};
const resumo346={contagens:{todas:900,ia:3,aprovacao:2,handoff:1,humano:5,semResposta:4,naoAtribuidas:7},aria:{estado:"ATIVA" as const,pausada:false,podeGerenciar:false}};
const props={resumo:resumo346,inicial:{itens:[item],proximo:null},filtros:{busca:"Ana"},selecionado:"a1",usuario:{id:"u345",papeis:["VENDEDOR"]},fuso:null} as PropsInboxNovo;
const global345:AvisoInbox={tipo:"aria.global",atendimentoId:null,mensagemId:null,conversaId:""};
const nova345:AvisoInbox={tipo:"mensagem.nova",atendimentoId:"a1",mensagemId:"m2",conversaId:"cv1"};
let root:Root|undefined,InboxNovo:typeof Inbox;
const fetcher=vi.fn<typeof fetch>();
const paineis=()=>fetcher.mock.calls.filter(([url])=>String(url).endsWith("/painel"));
const listas=()=>fetcher.mock.calls.filter(([url])=>String(url).startsWith("/api/inbox/atendimentos?"));

beforeEach(async()=>{
  vi.clearAllMocks();m.receber=null;m.observado=null;m.ariaRecebida=null;m.leituraRecebida=undefined;m.bloqueioRecebido=undefined;
  const dom=criarDomMinimo(),doc=dom.documento;
  Object.assign(doc,{visibilityState:"visible",addEventListener(){},removeEventListener(){},querySelector:(s:string)=>doc.body.querySelector(s)});
  Object.assign(dom.janela,{setTimeout:(callback:()=>void,ms:number)=>setTimeout(callback,ms),innerWidth:1440,addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})});
  vi.stubGlobal("window",dom.janela);vi.stubGlobal("self",dom.janela);vi.stubGlobal("document",doc);vi.stubGlobal("MutationObserver",dom.MutationObserver);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
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

const chips346=()=>document.querySelector('[aria-label="Filtros rápidos"]')?.textContent;
it("346 SSR inicial entrega os sete totais reais à coluna",()=>{expect(chips346()).toContain("IA atendendo3");expect(chips346()).toContain("Todas900");});
it("346 global atualiza resumo fresco e falha preserva o último conhecido",async()=>{
 const original=fetcher.getMockImplementation()!;
 fetcher.mockImplementation(async(u,o)=>String(u).startsWith("/api/inbox/atendimentos?")?new Response(JSON.stringify({...props.inicial,resumo:{...resumo346,contagens:{...resumo346.contagens,ia:0}}})):original(u,o));
 await emitir(global345);expect(chips346()).toContain("IA atendendo0");
 fetcher.mockImplementation(async(u,o)=>String(u).startsWith("/api/inbox/atendimentos?")?new Response("",{status:503}):original(u,o));
 await emitir(global345);expect(chips346()).toContain("IA atendendo0");expect(m.pagina).not.toHaveBeenCalled();
});
it("346 GET antigo não substitui o resumo SSR de outra navegação",async()=>{
 const original=fetcher.getMockImplementation()!;let finish!:(r:Response)=>void;
 fetcher.mockImplementation((u,o)=>String(u).startsWith("/api/inbox/atendimentos?")?new Promise(r=>{finish=r;}):original(u,o));
 await emitir(global345);expect(finish).toBeTypeOf("function");
 await act(async()=>root!.render(createElement(InboxNovo,{...props,filtros:{busca:"nova"},resumo:{...resumo346,contagens:{...resumo346.contagens,ia:12}}})));
 await act(async()=>{finish(new Response(JSON.stringify({...props.inicial,resumo:{...resumo346,contagens:{...resumo346.contagens,ia:999}}})));await vi.advanceTimersByTimeAsync(50);});
 expect(chips346()).toContain("IA atendendo12");expect(chips346()).not.toContain("999");
});

it("347 faixa e chips reconciliam MESMO resumo SSE, preservando o link focado",async()=>{
 const original=fetcher.getMockImplementation()!;
 let resumo:NonNullable<PropsInboxNovo["resumo"]>={...resumo346,aria:{...resumo346.aria,podeGerenciar:true},contagens:{...resumo346.contagens,ia:8,aprovacao:3,handoff:2}};
 fetcher.mockImplementation((u,o)=>String(u).startsWith("/api/inbox/atendimentos?")?Promise.resolve(new Response(JSON.stringify({...props.inicial,resumo}))):original(u,o));
 await emitir(global345);const faixa=()=>document.querySelector('[aria-label="Situação da Aria"]');expect(faixa()?.textContent).toContain("8 em atendimento · 5 aguardando você");expect(chips346()).toContain("IA atendendo8");
 const link=faixa()!.querySelector('a')!;link.focus();
 resumo={...resumo,aria:{...resumo.aria,pausada:true},contagens:{...resumo.contagens,ia:0}};
 await emitir(global345);expect(faixa()?.textContent).toContain("Aria pausada");expect(chips346()).toContain("IA atendendo0");expect(document.activeElement===link).toBe(true);
 resumo={...resumo,aria:{...resumo.aria,estado:"SHADOW" as const,pausada:false}};
 await emitir(global345);expect(faixa()?.textContent).toContain("Aria em ensaio");expect(document.activeElement===link).toBe(true);expect(m.pagina).not.toHaveBeenCalled();
});
it("347 erro na recarga mantém faixa/contagem conhecidas e global não substitui aviso da thread",async()=>{
 const original=fetcher.getMockImplementation()!;
 fetcher.mockImplementation((u,o)=>String(u).startsWith("/api/inbox/atendimentos?")?Promise.resolve(new Response("",{status:503})):original(u,o));
 await emitir(nova345,global345);expect(m.observado).toBe(nova345);expect(document.querySelector('[aria-label="Situação da Aria"]')?.textContent).toContain("Aria ativa3 em atendimento · 3 aguardando você");expect(chips346()).toContain("IA atendendo3");
});

it("348 painel corrente mantém história no503 e revoga só capacidades Aria no404",async()=>{
 const original=fetcher.getMockImplementation()!;
 const aria={handoff:null,podeDecidir:true,cartoes:[],pausada:true,motivo:"MANUAL" as const,podeDevolver:true,};
 let status=200;
 fetcher.mockImplementation((u,o)=>String(u).endsWith("/painel")?Promise.resolve(status===200?new Response(JSON.stringify({setor:"COMERCIAL",oportunidade:null,pessoaId:null,podeEnviar:true,aria,acoes:null})):new Response("",{status})):original(u,o));
 await emitir(global345);expect(m.ariaRecebida).toEqual(aria);
 status=503;await emitir(global345);expect(m.ariaRecebida).toEqual(aria);
 status=404;await emitir(global345);expect(m.ariaRecebida).toEqual({...aria,podeDevolver:false,podeDecidir:false,podeAssumirAria:false});
});

it("352 recibo da leitura existente distingue200/503 e404 revoga capacidades do handoff sem apagar resumo",async()=>{
 const original=fetcher.getMockImplementation()!;
 const handoff={acaoId:"h352",pedidoEm:"2026-10-25T00:00:00Z",motivo:null,motivoTexto:"Motivo",destino:"FILA_SETOR",responsavelNome:null,resumo:{quer:"Histórico visível",proximoPasso:null},feito:[],podeAssumir:true,ehResponsavel:true};
 const aria={handoff,podeDecidir:true,cartoes:[],pausada:true,motivo:"HANDOFF" as const,podeDevolver:true,};let status=200;
 fetcher.mockImplementation((u,o)=>String(u).endsWith("/painel")?Promise.resolve(status===200?new Response(JSON.stringify({setor:"COMERCIAL",oportunidade:null,pessoaId:null,podeEnviar:true,aria,acoes:null})):new Response("",{status})):original(u,o));
 await emitir(global345);expect(m.leituraRecebida?.resultado).toBe("ok");expect(m.leituraRecebida?.finalizada).toBe(m.leituraRecebida?.solicitada);const primeira=m.leituraRecebida!.finalizada;
 status=503;await emitir(global345);expect(m.leituraRecebida?.resultado).toBe("falha");expect(m.leituraRecebida!.finalizada).toBeGreaterThan(primeira);expect(m.ariaRecebida).toEqual(aria);
 status=404;await emitir(global345);expect(m.leituraRecebida?.resultado).toBe("sem-acesso");expect(m.ariaRecebida?.handoff).toEqual({...handoff,podeAssumir:false,ehResponsavel:false});
});

it("434 marcador cliente404 persiste503 e só200 fresco recupera decisões sem remover cartões",async()=>{
 const original=fetcher.getMockImplementation()!,cartao={id:"s404",status:"SUGERIDA"};const aria={handoff:null,podeDecidir:false,cartoes:[cartao],pausada:false,motivo:null,podeDevolver:false};let status=200;
 fetcher.mockImplementation((u,o)=>String(u).endsWith("/painel")?Promise.resolve(status===200?new Response(JSON.stringify({setor:"COMERCIAL",podeEnviar:false,aria,acoes:null})):new Response("",{status})):original(u,o));
 await emitir(global345);expect(m.bloqueioRecebido).toBe(false);expect(m.ariaRecebida?.podeDecidir).toBe(false);
 status=503;await emitir(global345);expect(m.bloqueioRecebido).toBe(false);
 status=404;await emitir(global345);expect(m.bloqueioRecebido).toBe(true);expect(m.ariaRecebida?.cartoes).toEqual([cartao]);
 status=503;await emitir(global345);expect(m.bloqueioRecebido).toBe(true);expect(m.ariaRecebida?.cartoes).toEqual([cartao]);
 status=200;await emitir(global345);expect(m.bloqueioRecebido).toBe(false);expect(m.ariaRecebida?.podeDecidir).toBe(false);expect(m.ariaRecebida?.cartoes).toEqual([cartao]);
});it("434200 antigo não limpa marcador404 após revisão503 mais nova",async()=>{
 const original=fetcher.getMockImplementation()!;const aria={handoff:null,podeDecidir:false,cartoes:[{id:"s404",status:"SUGERIDA"}],pausada:false,motivo:null,podeDevolver:false};let fase:"404"|"lento"|"503"|"200"="404";let resolver!:(r:Response)=>void;
 fetcher.mockImplementation((u,o)=>!String(u).endsWith("/painel")?original(u,o):fase==="lento"?new Promise<Response>(r=>{resolver=r;}):Promise.resolve(fase==="200"?new Response(JSON.stringify({podeEnviar:false,aria})):new Response("",{status:Number(fase)})));
 await emitir(global345);expect(m.bloqueioRecebido).toBe(true);fase="lento";await emitir(global345);fase="503";await emitir(global345);expect(m.bloqueioRecebido).toBe(true);
 await act(async()=>resolver(new Response(JSON.stringify({podeEnviar:false,aria}))));expect(m.bloqueioRecebido).toBe(true);
 fase="200";await emitir(global345);expect(m.bloqueioRecebido).toBe(false);expect(m.ariaRecebida?.podeDecidir).toBe(false);
});

it("359 ACK da faixa reutiliza a mesma recarga de lista/painel sem SSE paralelo",async()=>{expect(m.aoMudarFaixa).toBeTypeOf("function");await act(async()=>m.aoMudarFaixa!());await act(async()=>{await vi.advanceTimersByTimeAsync(50);});expect(listas()).toHaveLength(1);expect(paineis()).toHaveLength(1);expect(m.pagina).not.toHaveBeenCalled();expect(m.marcar).not.toHaveBeenCalled();});

it("359 faixa muda para pausada somente pelo resumo fresco do aviso global e conserva503",async()=>{
 const regiao=()=>document.querySelector('[aria-label="Situação da Aria"]')?.textContent;
 expect(regiao()).toContain("Aria ativa");const original=fetcher.getMockImplementation()!;
 fetcher.mockImplementation(async(u,o)=>String(u).startsWith("/api/inbox/atendimentos?")?new Response(JSON.stringify({...props.inicial,resumo:{...resumo346,aria:{...resumo346.aria,pausada:true}}})):original(u,o));
 await emitir(global345);expect(regiao()).toContain("Aria pausada");expect(regiao()).toContain("Pausada · novas conversas vão para a equipe");
 fetcher.mockImplementation(async(u,o)=>String(u).startsWith("/api/inbox/atendimentos?")?new Response("",{status:503}):original(u,o));
 await emitir(global345);expect(regiao()).toContain("Aria pausada");expect(m.pagina).not.toHaveBeenCalled();
});
