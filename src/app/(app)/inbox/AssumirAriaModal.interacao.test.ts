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
type P={id?:string;handoff?:HandoffDoAtendimento|null;cap?:boolean;owner?:string|null;envio?:boolean;leitura?:LeituraPainelHandoff};
function Tela({id="A",handoff=h,cap=true,owner=null,envio=true,leitura={solicitada:0,finalizada:0,resultado:"ok"}}:P){
 const p:PropsHandoffConversa&{podeAssumirAria:boolean}={item:{id,contatoNome:"Fixture",grupo:false,status:"EM_ATENDIMENTO",responsavelId:owner},usuarioId:"u",handoff,podeEnviar:envio,leitura,fuso:"UTC",agora:new Date("2026-10-25T12:01:00Z"),aoMudar:()=>m.mudar(),podeAssumirAria:cap};
 const c=useHandoffConversa(p);return createElement("section",null,c.faixa,c.modal,createElement(RodapeConversa,{modo:"compositor",atendimentoId:id,podeEnviar:envio,capacidades:[],aoEnviarTexto:async()=>({ok:true as const}),aoEnviarMidia:async()=>({ok:true as const}),aoNota:async()=>({ok:true as const}),controleResposta:c.controleResposta,aoCampoResponder:c.aoCampoResponder}),createElement("textarea",{"data-outro":""}));
}
let root:Root,doc:Documento,host:Elemento;
function eventos(e:Elemento){const k=Object.keys(e).find(k=>k.startsWith("__reactProps"))!;return(e as unknown as Record<string,{onClick():void}>)[k];}
const dialogo=()=>doc.body.querySelector('[role="dialog"]');
const botao=(nome:string,onde:Elemento=dialogo()??doc.body)=>onde.querySelectorAll("button").find(e=>e.textContent===nome);
const clicar=async(nome:string)=>act(async()=>{expect(Boolean(botao(nome))).toBe(true);eventos(botao(nome)!).onClick();});
const montar=async(p:P={})=>act(async()=>root.render(createElement(Tela,{key:p.id??"A",...p})));
beforeEach(async()=>{vi.resetAllMocks();m.legado.mockResolvedValue({ok:true});m.aria.mockResolvedValue({ok:true});const d=criarDomMinimo();doc=d.documento;Object.assign(doc,{createElementNS:(_n:string,t:string)=>doc.createElement(t),addEventListener(){},removeEventListener(){}});Object.assign(d.janela,{innerWidth:390,innerHeight:844,addEventListener(){},removeEventListener(){}});vi.stubGlobal("window",d.janela);vi.stubGlobal("document",doc);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.stubGlobal("MutationObserver",d.MutationObserver);const storage=new Map<string,string>();vi.stubGlobal("localStorage",{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)});host=doc.createElement("div");doc.body.appendChild(host);const{createRoot}=await import("react-dom/client");root=createRoot(host as unknown as HTMLElement);});
afterEach(async()=>{await act(async()=>root.unmount());desligarObservadores();vi.unstubAllGlobals();});
it("357 modal da fila usa nova action e aguarda painel fresco para foco",async()=>{
 let resolver!:(r:{ok:true})=>void;m.aria.mockImplementationOnce(()=>new Promise(r=>resolver=r));await montar();await clicar("Ver resumo e assumir");await clicar("Assumir e responder");expect(m.aria).toHaveBeenCalledExactlyOnceWith("A");expect(m.legado).not.toHaveBeenCalled();
 await act(async()=>resolver({ok:true}));expect(m.mudar).toHaveBeenCalledOnce();expect(Boolean(dialogo())).toBe(true);
 await montar({handoff:null,owner:"u",leitura:{solicitada:1,finalizada:1,resultado:"falha"}});expect(Boolean(dialogo())).toBe(true);expect(doc.activeElement===host.querySelector('[data-compositor-campo]')).toBe(false);
 await clicar("Tentar de novo");expect(m.mudar).toHaveBeenCalledTimes(2);
 await montar({handoff:null,owner:"u",leitura:{solicitada:2,finalizada:2,resultado:"ok"}});expect(dialogo()).toBeNull();expect(doc.activeElement===host.querySelector('[data-compositor-campo]')).toBe(true);expect(doc.activeElement===host.querySelector('[data-outro]')).toBe(false);
});
it("357 Responder do responsável faz transição MANUAL antes de pedir foco",async()=>{
 await montar({owner:"u",handoff:{...h,podeAssumir:false,ehResponsavel:true}});await clicar("Ver resumo");await clicar("Responder");expect(m.aria).toHaveBeenCalledExactlyOnceWith("A");expect(m.legado).not.toHaveBeenCalled();expect(m.mudar).toHaveBeenCalledOnce();expect(Boolean(dialogo())).toBe(true);
});
it("357 capacidade de envio falsa torna o modal só leitura mesmo com handoff antigo acionável",async()=>{await montar({cap:false});await clicar("Ver resumo e assumir");expect(Boolean(botao("Assumir e responder"))).toBe(false);expect(Boolean(botao("Fechar"))).toBe(true);expect(m.aria).not.toHaveBeenCalled();});
it("357 ACK não atravessa capacidade perdida e devolvida na mesma abertura",async()=>{
 let resolver!:(r:{ok:true})=>void;m.aria.mockImplementationOnce(()=>new Promise(r=>resolver=r));await montar();await clicar("Ver resumo e assumir");await clicar("Assumir e responder");expect(m.aria).toHaveBeenCalledOnce();await montar({cap:false});await montar();await act(async()=>resolver({ok:true}));expect(m.mudar).not.toHaveBeenCalled();expect(Boolean(dialogo())).toBe(true);expect(Boolean(botao("Assumir e responder"))).toBe(false);
});
it("357 404 após ACK não autoriza foco quando capacidade volta com503",async()=>{
 await montar();await clicar("Ver resumo e assumir");await clicar("Assumir e responder");expect(m.aria).toHaveBeenCalledOnce();await montar({cap:false,envio:false,leitura:{solicitada:1,finalizada:1,resultado:"sem-acesso"}});await montar({leitura:{solicitada:2,finalizada:2,resultado:"falha"}});expect(doc.activeElement===host.querySelector('[data-compositor-campo]')).toBe(false);expect(Boolean(botao("Assumir e responder"))).toBe(false);
});

it("T357 SSE próprio antes do ACK preserva intenção; somente 200 posterior ao ACK conclui",async()=>{
 let resolver!:(r:{ok:true})=>void;m.aria.mockImplementationOnce(()=>new Promise(r=>resolver=r));await montar();await clicar("Ver resumo e assumir");await clicar("Assumir e responder");
 await montar({handoff:null,owner:"u",leitura:{solicitada:1,finalizada:1,resultado:"ok"}});
 expect(Boolean(dialogo())).toBe(true);expect(doc.activeElement===host.querySelector('[data-compositor-campo]')).toBe(false);
 await act(async()=>resolver({ok:true}));expect(m.mudar,"ACK da tentativa atual deve pedir leitura posterior, mesmo com próprio SSE já confirmado").toHaveBeenCalledOnce();
 expect(Boolean(dialogo())).toBe(true);
 await montar({handoff:null,owner:"u",leitura:{solicitada:2,finalizada:2,resultado:"ok"}});
 expect(dialogo()).toBeNull();expect(doc.activeElement===host.querySelector('[data-compositor-campo]')).toBe(true);
});
it("T357 erro antigo A→B→A não anuncia erro nem foca nova abertura",async()=>{
 let rejeitar!:(e:Error)=>void;m.aria.mockImplementationOnce(()=>new Promise((_r,j)=>rejeitar=j));await montar();await clicar("Ver resumo e assumir");await clicar("Assumir e responder");await montar({id:"B"});await montar();await clicar("Ver resumo e assumir");const foco=doc.activeElement;
 await act(async()=>rejeitar(Error("Transporte antigo T357")));expect(m.mudar).not.toHaveBeenCalled();expect(Boolean(dialogo())).toBe(true);expect(dialogo()!.textContent).not.toContain("Resultado não confirmado");expect(doc.activeElement).toBe(foco);
});
it("T357 200 sem clique não chama transição nem muda foco",async()=>{
 await montar({owner:"u",handoff:{...h,podeAssumir:false,ehResponsavel:true}});await clicar("Ver resumo");const foco=doc.activeElement;await montar({owner:"u",handoff:{...h,podeAssumir:false,ehResponsavel:true},leitura:{solicitada:1,finalizada:1,resultado:"ok"}});expect(m.aria).not.toHaveBeenCalled();expect(m.mudar).not.toHaveBeenCalled();expect(Boolean(dialogo())).toBe(true);expect(doc.activeElement).toBe(foco);
});
it.each(["owner-outro","capacidade","404"] as const)("357 SSE anterior ao ACK não atravessa %s nem volta posterior",async caso=>{
 let resolver!:(r:{ok:true})=>void;m.aria.mockImplementationOnce(()=>new Promise(r=>resolver=r));await montar();await clicar("Ver resumo e assumir");await clicar("Assumir e responder");
 await montar({handoff:null,owner:caso==="owner-outro"?"outra":"u",cap:caso!=="capacidade",leitura:{solicitada:1,finalizada:1,resultado:caso==="404"?"sem-acesso":"ok"}});
 await montar({handoff:null,owner:"u",leitura:{solicitada:2,finalizada:2,resultado:"ok"}});await act(async()=>resolver({ok:true}));
 expect(m.mudar).not.toHaveBeenCalled();expect(doc.activeElement===host.querySelector('[data-compositor-campo]')).toBe(false);
});
it.each(["negocio","transporte"] as const)("357 erro %s depois do SSE próprio preserva resumo sem simular ACK",async caso=>{
 let fim!:(r:{ok:false;erro:string})=>void,rejeitar!:(e:Error)=>void;m.aria.mockImplementationOnce(()=>new Promise((r,j)=>{fim=r;rejeitar=j;}));
 await montar();await clicar("Ver resumo e assumir");await clicar("Assumir e responder");await montar({handoff:null,owner:"u",leitura:{solicitada:1,finalizada:1,resultado:"ok"}});
 await act(async()=>{if(caso==="negocio")fim({ok:false,erro:"Resultado recusado357"});else rejeitar(Error("Rede357"));});
 expect(Boolean(dialogo())).toBe(true);expect(m.mudar).not.toHaveBeenCalled();expect(dialogo()!.textContent).toContain(caso==="negocio"?"Resultado recusado357":"Resultado não confirmado");
 await montar({handoff:null,owner:"u",leitura:{solicitada:2,finalizada:2,resultado:"ok"}});expect(doc.activeElement===host.querySelector('[data-compositor-campo]')).toBe(false);expect(m.aria).toHaveBeenCalledOnce();
});
it("357 outro owner após ACK invalida intenção mesmo se owner voltar com200",async()=>{
 await montar();await clicar("Ver resumo e assumir");await clicar("Assumir e responder");expect(m.mudar).toHaveBeenCalledOnce();
 await montar({handoff:null,owner:"outra",leitura:{solicitada:1,finalizada:1,resultado:"ok"}});await montar({handoff:null,owner:"u",leitura:{solicitada:2,finalizada:2,resultado:"ok"}});
 expect(doc.activeElement===host.querySelector('[data-compositor-campo]')).toBe(false);
});
it("357 próprio SSE com duplo clique mantém campo/rascunho e exige200 pedido após ACK",async()=>{
 let resolver!:(r:{ok:true})=>void;m.aria.mockImplementationOnce(()=>new Promise(r=>resolver=r));await montar();const campo=host.querySelector('[data-compositor-campo]')!;
 await act(async()=>{(eventos(campo) as unknown as {onChange(e:{target:{value:string;selectionStart:number}}):void}).onChange({target:{value:"Rascunho357",selectionStart:12}});});
 await clicar("Ver resumo e assumir");await act(async()=>{eventos(botao("Assumir e responder")!).onClick();eventos(botao("Assumir e responder")!).onClick();});expect(m.aria).toHaveBeenCalledOnce();
 await montar({handoff:null,owner:"u",leitura:{solicitada:1,finalizada:1,resultado:"ok"}});expect(host.querySelector('[data-compositor-campo]')).toBe(campo);expect((campo as unknown as HTMLTextAreaElement).value).toBe("Rascunho357");
 await act(async()=>resolver({ok:true}));expect(Boolean(dialogo())).toBe(true);await montar({handoff:null,owner:"u",leitura:{solicitada:1,finalizada:1,resultado:"ok"}});expect(Boolean(dialogo())).toBe(true);
 await montar({handoff:null,owner:"u",leitura:{solicitada:2,finalizada:2,resultado:"ok"}});expect(dialogo()).toBeNull();expect(host.querySelector('[data-compositor-campo]')).toBe(campo);expect((campo as unknown as HTMLTextAreaElement).value).toBe("Rascunho357");expect(doc.activeElement).toBe(campo);expect(m.mudar).toHaveBeenCalledOnce();
});
it("357 próprio SSE não revive recibo após unmount e nova abertura",async()=>{
 let resolver!:(r:{ok:true})=>void;m.aria.mockImplementationOnce(()=>new Promise(r=>resolver=r));await montar();await clicar("Ver resumo e assumir");await clicar("Assumir e responder");await montar({handoff:null,owner:"u",leitura:{solicitada:1,finalizada:1,resultado:"ok"}});
 await act(async()=>root.render(null));await montar();await clicar("Ver resumo e assumir");await act(async()=>resolver({ok:true}));expect(m.mudar).not.toHaveBeenCalled();expect(Boolean(dialogo())).toBe(true);
});
it.each(["pendente","falha"] as const)("357 GET %s solicitado antes do ACK não substitui GET posterior",async resultado=>{
 let resolver!:(r:{ok:true})=>void;m.aria.mockImplementationOnce(()=>new Promise(r=>resolver=r));await montar();await clicar("Ver resumo e assumir");await clicar("Assumir e responder");
 await montar({handoff:null,owner:"u",leitura:{solicitada:1,finalizada:1,resultado:"ok"}});
 await montar({handoff:null,owner:"u",leitura:{solicitada:2,finalizada:resultado==="pendente"?1:2,resultado}});expect(Boolean(dialogo())).toBe(true);
 await act(async()=>resolver({ok:true}));expect(m.mudar).toHaveBeenCalledOnce();await montar({handoff:null,owner:"u",leitura:{solicitada:2,finalizada:2,resultado:"ok"}});expect(Boolean(dialogo())).toBe(true);expect(doc.activeElement===host.querySelector('[data-compositor-campo]')).toBe(false);
 await montar({handoff:null,owner:"u",leitura:{solicitada:3,finalizada:3,resultado:"ok"}});expect(dialogo()).toBeNull();expect(doc.activeElement===host.querySelector('[data-compositor-campo]')).toBe(true);
});
it("357 desatribuição após próprio200 invalida recibo sem confundir owner nulo ainda não confirmado",async()=>{
 let resolver!:(r:{ok:true})=>void;m.aria.mockImplementationOnce(()=>new Promise(r=>resolver=r));await montar();await clicar("Ver resumo e assumir");await clicar("Assumir e responder");await montar({handoff:null,owner:"u",leitura:{solicitada:1,finalizada:1,resultado:"ok"}});
 await montar({handoff:null,owner:null,leitura:{solicitada:2,finalizada:2,resultado:"ok"}});await montar({handoff:null,owner:"u",leitura:{solicitada:3,finalizada:3,resultado:"ok"}});await act(async()=>resolver({ok:true}));expect(m.mudar).not.toHaveBeenCalled();expect(doc.activeElement===host.querySelector('[data-compositor-campo]')).toBe(false);
});
it("357 cancelar resumo retido e reabrir cria geração independente do ACK antigo",async()=>{
 let resolver!:(r:{ok:true})=>void;m.aria.mockImplementationOnce(()=>new Promise(r=>resolver=r));await montar();await clicar("Ver resumo e assumir");await clicar("Assumir e responder");await montar({handoff:null,owner:"u",leitura:{solicitada:1,finalizada:1,resultado:"ok"}});await clicar("Cancelar");expect(dialogo()).toBeNull();
 await montar({handoff:{...h,acaoId:"h-novo357"}});await clicar("Ver resumo e assumir");const foco=doc.activeElement;await act(async()=>resolver({ok:true}));expect(m.mudar).not.toHaveBeenCalled();expect(Boolean(dialogo())).toBe(true);expect(doc.activeElement).toBe(foco);
});
it.each(["nulo","snapshot"] as const)("357 envio revogado após own200 invalida mesmo com handoff %s e posterior reconcessão",async tipo=>{
 let resolver!:(r:{ok:true})=>void;m.aria.mockImplementationOnce(()=>new Promise(r=>resolver=r));await montar();await clicar("Ver resumo e assumir");await clicar("Assumir e responder");await montar({handoff:null,owner:"u",leitura:{solicitada:1,finalizada:1,resultado:"ok"}});
 await montar({handoff:tipo==="nulo"?null:h,owner:"u",envio:false,leitura:{solicitada:2,finalizada:2,resultado:"ok"}});
 await montar({handoff:h,owner:"u",envio:true,leitura:{solicitada:3,finalizada:3,resultado:"ok"}});await act(async()=>resolver({ok:true}));
 expect(m.mudar).not.toHaveBeenCalled();await montar({handoff:null,owner:"u",leitura:{solicitada:4,finalizada:4,resultado:"ok"}});expect(doc.activeElement===host.querySelector('[data-compositor-campo]')).toBe(false);
});