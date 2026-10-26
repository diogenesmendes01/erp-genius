import { act,createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { criarDomMinimo,desligarObservadores,type Elemento,type Documento } from "@/test/dom-minimo";
import type { SugestaoAriaThread } from "@/server/aria/sugestoes-thread";
const mocks=vi.hoisted(()=>({aprovar:vi.fn(),rejeitar:vi.fn(),desfazer:vi.fn()}));
vi.mock("@/server/aria/acoes",()=>({aprovarAcaoAria:mocks.aprovar,rejeitarAcaoAria:mocks.rejeitar,aprovarSugestaoNoInbox:mocks.aprovar,rejeitarSugestaoNoInbox:mocks.rejeitar,desfazerSugestaoNoInbox:mocks.desfazer}));
import { CartaoSugestaoAria } from "./CartaoSugestaoAria";
let root:Root,doc:Documento,host:Elemento;
const mudou=vi.fn();
const s=(o:Partial<SugestaoAriaThread>={}):SugestaoAriaThread=>({id:"s",turnoId:"t",acao:"TAG",status:"APROVADA",criadoEm:"2026-10-25T12:00Z",expiraEm:null,justificativa:null,texto:null,detalhe:{tipo:"tag",nome:"Interesse"},decididaPorId:"u",decididaPorNome:"Você",decididaEm:"2026-10-25T12:01Z",podeDecidir:false,podeDesfazer:true,...o});
const render=(o:Partial<SugestaoAriaThread>={},bloqueado=false,atendimentoId="A")=>act(async()=>root.render(createElement(CartaoSugestaoAria,{s:s(o),atendimentoId,usuarioId:"u",fuso:"UTC",bloqueado,aoDecidir:mudou})));
const botao=(nome:string)=>doc.body.querySelectorAll("button").find(b=>b.textContent===nome)!;
const dialogo=()=>doc.body.querySelector('[role="alertdialog"]');
function evento(el:Elemento){const k=Object.keys(el).find(k=>k.startsWith("__reactProps"))!;return (el as unknown as Record<string,{onClick():void}>)[k];}
async function clicar(nome:string){await act(async()=>{const b=botao(nome);expect(b).toBeDefined();evento(b).onClick();});}
beforeEach(async()=>{
 vi.resetAllMocks();for(const m of Object.values(mocks))m.mockResolvedValue({ok:true});
 const dom=criarDomMinimo();doc=dom.documento;Object.assign(doc,{createElementNS:(_ns:string,tag:string)=>doc.createElement(tag),addEventListener(){},removeEventListener(){}});
 Object.assign(dom.janela,{innerWidth:390,innerHeight:844,addEventListener(){},removeEventListener(){}});
 vi.stubGlobal("document",doc);vi.stubGlobal("window",dom.janela);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.stubGlobal("MutationObserver",dom.MutationObserver);
 host=doc.createElement("div");doc.body.appendChild(host);const {createRoot}=await import("react-dom/client");root=createRoot(host as unknown as HTMLElement);
});
afterEach(async()=>{await act(async()=>root.unmount());desligarObservadores();vi.unstubAllGlobals();});
it("aprovar envia a identidade da conversa e ação à fronteira Inbox",async()=>{
 await render({status:"SUGERIDA",podeDecidir:true,podeDesfazer:false});await clicar("Aprovar");expect(mocks.aprovar).toHaveBeenCalledExactlyOnceWith("A","s");
});
it("capacidade por cartão nega DOM e handler mesmo sem marcador404",async()=>{
 await render({status:"SUGERIDA",podeDecidir:false,podeDesfazer:false});const b=botao("Aprovar");expect(b.hasAttribute("disabled")).toBe(true);await clicar("Aprovar");expect(mocks.aprovar).not.toHaveBeenCalled();
});
it("desfazer exige confirmação real, foco seguro e callback atual",async()=>{
 await render();const trigger=botao("Desfazer");trigger.focus();await clicar("Desfazer");expect(dialogo()).not.toBeNull();expect(mocks.desfazer).not.toHaveBeenCalled();expect(doc.activeElement).toBe(botao("Voltar"));
 await clicar("Confirmar desfazer sugestão");expect(mocks.desfazer).toHaveBeenCalledExactlyOnceWith("A","s");expect(mudou).toHaveBeenCalledTimes(1);expect(dialogo()).toBeNull();
});
it("cancelar não executa e devolve foco ao mesmo gatilho",async()=>{
 await render();const trigger=botao("Desfazer");trigger.focus();await clicar("Desfazer");await clicar("Voltar");expect(mocks.desfazer).not.toHaveBeenCalled();expect(doc.activeElement).toBe(trigger);
});
it("erro mantém confirmação e permite retry deliberado",async()=>{
 mocks.desfazer.mockResolvedValueOnce({ok:false,erro:"A tarefa já foi tratada por uma pessoa."});await render();await clicar("Desfazer");await clicar("Confirmar desfazer sugestão");expect(dialogo()?.textContent).toContain("já foi tratada");expect(mudou).not.toHaveBeenCalled();await clicar("Confirmar desfazer sugestão");expect(mocks.desfazer).toHaveBeenCalledTimes(2);expect(mudou).toHaveBeenCalledTimes(1);
});
it("revogação404 invalida confirmação e ACK mesmo após200",async()=>{
 let ack!:(v:{ok:true})=>void;mocks.desfazer.mockReturnValue(new Promise(r=>{ack=r;}));await render();await clicar("Desfazer");await clicar("Confirmar desfazer sugestão");await render({},true);expect(dialogo()).toBeNull();await render();await act(async()=>ack({ok:true}));expect(mudou).not.toHaveBeenCalled();
});
it("A→B→A não reaproveita confirmação nem ACK",async()=>{
 let ack!:(v:{ok:true})=>void;mocks.desfazer.mockReturnValue(new Promise(r=>{ack=r;}));await render();await clicar("Desfazer");await clicar("Confirmar desfazer sugestão");await render({},false,"B");await render();await act(async()=>ack({ok:true}));expect(mudou).not.toHaveBeenCalled();expect(dialogo()).toBeNull();
});
it("sem capacidade de desfazer não exibe CTA",async()=>{await render({podeDesfazer:false});expect(botao("Desfazer")).toBeUndefined();});
it("perda e recuperação de capacidade não reabre confirmação nem aceita ACK antigo",async()=>{
 let ack!:(v:{ok:true})=>void;mocks.desfazer.mockReturnValue(new Promise(r=>{ack=r;}));await render();await clicar("Desfazer");await clicar("Confirmar desfazer sugestão");await render({podeDesfazer:false});expect(dialogo()).toBeNull();await render();expect(dialogo()).toBeNull();await act(async()=>ack({ok:true}));expect(mudou).not.toHaveBeenCalled();
});
it("handler da confirmação antiga não decide depois de capacidade revogada",async()=>{
 await render();await clicar("Desfazer");const antigo=evento(botao("Confirmar desfazer sugestão"));await render({podeDesfazer:false});await act(async()=>antigo.onClick());expect(mocks.desfazer).not.toHaveBeenCalled();expect(mudou).not.toHaveBeenCalled();
});
it("desfazer confirmado com painel síncrono mantém foco no resultado do mesmo cartão",async()=>{
 mudou.mockImplementation(()=>root.render(createElement(CartaoSugestaoAria,{s:s({status:"DESFEITA",podeDesfazer:false,desfeitaPorId:"u"}),atendimentoId:"A",usuarioId:"u",fuso:"UTC",aoDecidir:mudou})));
 await render();botao("Desfazer").focus();await clicar("Desfazer");botao("Confirmar desfazer sugestão").focus();await clicar("Confirmar desfazer sugestão");expect(doc.activeElement===host.querySelector('[role="status"]')).toBe(true);
});

it("painel recebido após confirmação devolve foco ao resultado sem roubar outro controle",async()=>{
 await render();botao("Desfazer").focus();await clicar("Desfazer");await clicar("Confirmar desfazer sugestão");
 const outro=doc.createElement("button");host.appendChild(outro);outro.focus();
 await render({status:"DESFEITA",podeDesfazer:false,desfeitaPorId:"u"});expect(doc.activeElement===outro).toBe(true);
});
it("capacidade autoritativa após aprovação conserva foco no status do mesmo cartão",async()=>{
 await render({status:"SUGERIDA",podeDecidir:true,podeDesfazer:false});botao("Aprovar").focus();
 await render({status:"APROVADA",podeDecidir:false,podeDesfazer:true});expect(doc.activeElement===host.querySelector('[role="status"]')).toBe(true);
});
