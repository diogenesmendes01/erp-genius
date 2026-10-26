import { act,createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { criarDomMinimo,desligarObservadores,type Documento,type Elemento } from "@/test/dom-minimo";
import { useHandoffConversa,type PropsHandoffConversa,type LeituraPainelHandoff } from "./aria/useHandoffConversa";
import { RodapeConversa } from "./RodapeConversa";
import type { HandoffDoAtendimento } from "@/server/aria/handoff-inbox";
const m=vi.hoisted(()=>({legado:vi.fn(),aria:vi.fn(),mudar:vi.fn()}));
vi.mock("@/server/whatsapp/acoes-atendimento",()=>({assumirAtendimento:m.legado,assumirConversaDaAria:m.aria}));
const h:HandoffDoAtendimento={acaoId:"h357",pedidoEm:"2026-10-25T12:00:00Z",motivo:"VALOR",motivoTexto:"Valor",destino:"FILA_SETOR",responsavelNome:null,resumo:{quer:"Fixture357",proximoPasso:"Responder"},feito:[],podeAssumir:true,ehResponsavel:false};
type P={disponivel?:boolean;id?:string;handoff?:HandoffDoAtendimento|null;cap?:boolean;owner?:string|null;envio?:boolean;leitura?:LeituraPainelHandoff};
function Tela({disponivel=true,id="A",handoff=h,cap=true,owner=null,envio=true,leitura={solicitada:0,finalizada:0,resultado:"ok"}}:P){
 const p:PropsHandoffConversa&{podeAssumirAria:boolean;respostaDisponivel:boolean}={item:{id,contatoNome:"Fixture",grupo:false,status:"EM_ATENDIMENTO",responsavelId:owner},usuarioId:"u",handoff,podeEnviar:envio,leitura,fuso:"UTC",agora:new Date("2026-10-25T12:01:00Z"),aoMudar:()=>m.mudar(),podeAssumirAria:cap,respostaDisponivel:disponivel};
 const c=useHandoffConversa(p);return createElement("section",null,c.faixa,c.modal,createElement(RodapeConversa,{modo:disponivel?"compositor":"travado",atendimentoId:id,podeEnviar:envio,capacidades:[],aoEnviarTexto:async()=>({ok:true as const}),aoEnviarMidia:async()=>({ok:true as const}),aoNota:async()=>({ok:true as const}),controleResposta:c.controleResposta,aoCampoResponder:c.aoCampoResponder}),createElement("textarea",{"data-outro":""}));
}
let root:Root,doc:Documento,host:Elemento;
function eventos(e:Elemento){const k=Object.keys(e).find(k=>k.startsWith("__reactProps"))!;return(e as unknown as Record<string,{onClick():void}>)[k];}
const dialogo=()=>doc.body.querySelector('[role="dialog"]');
const botao=(nome:string,onde:Elemento=dialogo()??doc.body)=>onde.querySelectorAll("button").find(e=>e.textContent===nome);
const clicar=async(nome:string)=>act(async()=>{expect(Boolean(botao(nome))).toBe(true);eventos(botao(nome)!).onClick();});
const montar=async(p:P={})=>act(async()=>root.render(createElement(Tela,{key:p.id??"A",...p})));
beforeEach(async()=>{vi.resetAllMocks();m.legado.mockResolvedValue({ok:true});m.aria.mockResolvedValue({ok:true});const d=criarDomMinimo();doc=d.documento;Object.assign(doc,{createElementNS:(_n:string,t:string)=>doc.createElement(t),addEventListener(){},removeEventListener(){}});Object.assign(d.janela,{innerWidth:390,innerHeight:844,addEventListener(){},removeEventListener(){}});vi.stubGlobal("window",d.janela);vi.stubGlobal("document",doc);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.stubGlobal("MutationObserver",d.MutationObserver);const storage=new Map<string,string>();vi.stubGlobal("localStorage",{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)});host=doc.createElement("div");doc.body.appendChild(host);const{createRoot}=await import("react-dom/client");root=createRoot(host as unknown as HTMLElement);});
afterEach(async()=>{await act(async()=>root.unmount());desligarObservadores();vi.unstubAllGlobals();});
it.each(["painel-primeiro","lista-primeiro"]as const)("358 modal adia foco sem revogar sessão; %s",async ordem=>{
 await montar({disponivel:false});await clicar("Ver resumo e assumir");await clicar("Assumir e responder");expect(m.aria).toHaveBeenCalledOnce();
 if(ordem==="painel-primeiro")await montar({disponivel:false,owner:"u",handoff:null,leitura:{solicitada:1,finalizada:1,resultado:"ok"}});else await montar({disponivel:true,owner:"u",handoff:null});
 expect(Boolean(dialogo())).toBe(true);expect(doc.activeElement===host.querySelector("[data-compositor-campo]")).toBe(false);
 await montar({disponivel:true,owner:"u",handoff:null,leitura:{solicitada:1,finalizada:1,resultado:"ok"}});expect(dialogo()).toBeNull();expect(doc.activeElement===host.querySelector("[data-compositor-campo]")).toBe(true);expect(m.aria).toHaveBeenCalledOnce();
});
it("358 modal503 e lista atrasada conservam retry sem repetir tomada nem aceitar GETanterior ao retry",async()=>{
 await montar({disponivel:false});await clicar("Ver resumo e assumir");await clicar("Assumir e responder");await montar({disponivel:false,owner:"u",handoff:null,leitura:{solicitada:1,finalizada:1,resultado:"falha"}});await clicar("Tentar de novo");
 await montar({disponivel:false,owner:"u",handoff:null,leitura:{solicitada:2,finalizada:2,resultado:"ok"}});expect(Boolean(dialogo())).toBe(true);expect(Boolean(botao("Tentar de novo"))).toBe(true);await clicar("Tentar de novo");expect(m.mudar).toHaveBeenCalledTimes(3);
 await montar({disponivel:true,owner:"u",handoff:null,leitura:{solicitada:2,finalizada:2,resultado:"ok"}});expect(Boolean(dialogo())).toBe(true);await montar({disponivel:true,owner:"u",handoff:null,leitura:{solicitada:3,finalizada:3,resultado:"ok"}});expect(dialogo()).toBeNull();expect(doc.activeElement===host.querySelector("[data-compositor-campo]")).toBe(true);expect(m.aria).toHaveBeenCalledOnce();
});
it("358 disponibilidade não confunde SSE próprio préACK com revogação nem foca recibo anterior",async()=>{
 let ack!:(r:{ok:true})=>void;m.aria.mockImplementationOnce(()=>new Promise(r=>ack=r));await montar({disponivel:false});await clicar("Ver resumo e assumir");await clicar("Assumir e responder");await montar({disponivel:false,owner:"u",handoff:null,leitura:{solicitada:1,finalizada:1,resultado:"ok"}});expect(Boolean(dialogo())).toBe(true);await act(async()=>ack({ok:true}));expect(m.mudar).toHaveBeenCalledOnce();
 await montar({disponivel:true,owner:"u",handoff:null,leitura:{solicitada:1,finalizada:1,resultado:"ok"}});expect(Boolean(dialogo())).toBe(true);await montar({disponivel:true,owner:"u",handoff:null,leitura:{solicitada:2,finalizada:2,resultado:"ok"}});expect(dialogo()).toBeNull();expect(doc.activeElement===host.querySelector("[data-compositor-campo]")).toBe(true);
});