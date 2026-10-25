import { act,createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { criarDomMinimo,desligarObservadores,type Elemento,type Documento } from "@/test/dom-minimo";
import type { Resultado } from "@/server/_shared/resultado";
import type { SugestaoAriaThread } from "@/server/aria/sugestoes-thread";
const mocks=vi.hoisted(()=>({aprovar:vi.fn<()=>Promise<Resultado>>(),rejeitar:vi.fn<()=>Promise<Resultado>>() }));
vi.mock("@/server/aria/acoes",()=>({aprovarSugestaoNoInbox:mocks.aprovar,rejeitarSugestaoNoInbox:mocks.rejeitar}));
// DOM mínimo não implementa namespace SVG; só os glifos são fakes. Executor/feedback/ReactDOM permanecem reais.
vi.mock("@tabler/icons-react",async()=>{const {createElement}=await import("react");const I=()=>createElement("span",{"aria-hidden":true});return {IconSparkles:I,IconSend:I,IconClock:I,IconArrowRight:I,IconListCheck:I,IconTag:I,IconForms:I,IconX:I,IconNote:I,IconPercentage:I,IconAlertTriangle:I};});
let Cartao:typeof import("./CartaoSugestaoAria").CartaoSugestaoAria,root:Root,host:Elemento,doc:Documento;
const listeners:{tipo:string;f:(e:Event)=>void;captura:boolean}[]=[];const mudou=vi.fn();
const s=(id="s"):SugestaoAriaThread=>({id,turnoId:"t",acao:"RESPONDER",status:"SUGERIDA",criadoEm:"2026-10-23T13:42Z",expiraEm:null,justificativa:null,texto:"Olá",detalhe:{tipo:"enviar",documento:false},decididaPorId:null,decididaPorNome:null,decididaEm:null});
const render=(id="s",bloqueado=false)=>act(async()=>root.render(createElement(Cartao,{atendimentoId:"thread",s:s(id),usuarioId:"u",fuso:"UTC",aoDecidir:mudou,bloqueado})));
const botao=(nome:string)=>host.querySelectorAll('button').find(b=>b.textContent===nome)!;
async function clicks(...alvos:Elemento[]){await act(async()=>{for(const alvo of alvos){let parou=false;const e={type:"click",target:alvo,button:0,bubbles:true,preventDefault(){},stopPropagation(){parou=true;}};for(const captura of [true,false])for(const l of [...listeners])if(!parou&&l.tipo==="click"&&l.captura===captura)l.f(e as unknown as Event);}});}
beforeEach(async()=>{const dom=criarDomMinimo();doc=dom.documento;vi.stubGlobal("document",doc);vi.stubGlobal("window",dom.janela);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);listeners.length=0;host=doc.createElement("div");doc.body.appendChild(host);Object.assign(host,{addEventListener(tipo:string,f:(e:Event)=>void,captura=false){listeners.push({tipo,f,captura});}});const {createRoot}=await import("react-dom/client");root=createRoot(host as unknown as HTMLElement);({CartaoSugestaoAria:Cartao}=await import("./CartaoSugestaoAria"));mocks.aprovar.mockReset().mockResolvedValue({ok:true});mocks.rejeitar.mockReset().mockResolvedValue({ok:true});mudou.mockReset();});
afterEach(async()=>{await act(async()=>root.unmount());desligarObservadores();vi.unstubAllGlobals();});
it("aprovar chama ID original e callback exatamente uma vez",async()=>{await render();await clicks(botao("Aprovar e enviar"));expect(mocks.aprovar).toHaveBeenCalledExactlyOnceWith("thread","s");expect(mocks.rejeitar).not.toHaveBeenCalled();expect(mudou).toHaveBeenCalledTimes(1);});
it("rejeitar chama só ID, sem motivo novo",async()=>{await render();await clicks(botao("Rejeitar"));expect(mocks.rejeitar).toHaveBeenCalledExactlyOnceWith("thread","s");expect(mudou).toHaveBeenCalledTimes(1);});
it("expirada mostra erro focado e não sinaliza sucesso",async()=>{mocks.aprovar.mockResolvedValue({ok:false,erro:"Esta sugestão expirou."});await render();await clicks(botao("Aprovar e enviar"));const erro=host.querySelector('[role="alert"]')!;expect(erro.textContent).toContain("Esta sugestão expirou.");expect(doc.activeElement).toBe(erro);expect(mudou).not.toHaveBeenCalled();expect(botao("Aprovar e enviar").hasAttribute("disabled")).toBe(false);});
it("transporte incerto permite retry manual natural sem automático",async()=>{mocks.aprovar.mockRejectedValueOnce(new Error("queda"));await render();await clicks(botao("Aprovar e enviar"));expect(host.querySelector('[role="alert"]')?.textContent).toBeTruthy();expect(mudou).not.toHaveBeenCalled();expect(mocks.aprovar).toHaveBeenCalledTimes(1);await clicks(botao("Aprovar e enviar"));expect(mocks.aprovar).toHaveBeenCalledTimes(2);expect(mudou).toHaveBeenCalledTimes(1);});
it("clique duplo e rejeitar durante aprovação não duplicam execução",async()=>{let liberar!:(r:Resultado)=>void;mocks.aprovar.mockReturnValue(new Promise(r=>{liberar=r;}));await render();const aprovar=botao("Aprovar e enviar"),rejeitar=botao("Rejeitar");await clicks(aprovar,aprovar,rejeitar);expect(mocks.aprovar).toHaveBeenCalledTimes(1);expect(mocks.rejeitar).not.toHaveBeenCalled();expect(aprovar.getAttribute("aria-busy")).toBe("true");expect(rejeitar.hasAttribute("disabled")).toBe(true);await act(async()=>liberar({ok:true}));expect(mudou).toHaveBeenCalledTimes(1);});
it("ACK de cartão desmontado não atualiza o novo contexto",async()=>{let liberar!:(r:Resultado)=>void;mocks.aprovar.mockReturnValue(new Promise(r=>{liberar=r;}));await render("a");await clicks(botao("Aprovar e enviar"));await render("b");const novo=botao("Aprovar e enviar");novo.focus();await act(async()=>liberar({ok:true}));expect(mudou).not.toHaveBeenCalled();expect(doc.activeElement).toBe(novo);expect(novo.hasAttribute("disabled")).toBe(false);});

function handler(el:Elemento){const k=Object.keys(el).find(k=>k.startsWith("__reactProps"))!;return (el as unknown as Record<string,{onClick():void}>)[k].onClick;}
it("434 revogado preserva cartão e desabilita DOM e handlers diretos das duas decisões",async()=>{
 await render("s",true);expect(host.textContent).toContain("Olá");const aprovar=botao("Aprovar e enviar"),rejeitar=botao("Rejeitar");expect(aprovar.hasAttribute("disabled")).toBe(true);expect(rejeitar.hasAttribute("disabled")).toBe(true);
 await act(async()=>{handler(aprovar)();handler(rejeitar)();});expect(mocks.aprovar).not.toHaveBeenCalled();expect(mocks.rejeitar).not.toHaveBeenCalled();expect(mudou).not.toHaveBeenCalled();
});
it.each(["ok","erro","transporte"] as const)("434 ACK antigo %s não revive após404→200 e geração recuperada decide normalmente",async(tipo)=>{
 let resolver!:(r:Resultado)=>void,rejeitar!:(e:Error)=>void;mocks.aprovar.mockReturnValueOnce(new Promise((r,j)=>{resolver=r;rejeitar=j;}));
 await render();await clicks(botao("Aprovar e enviar"));await render("s",true);await render("s",false);
 const fora=doc.createElement("button");doc.body.appendChild(fora);fora.focus();await act(async()=>{if(tipo==="transporte")rejeitar(Error("antigo"));else resolver(tipo==="ok"?{ok:true}:{ok:false,erro:"Erro antigo"});});
 expect(mudou).not.toHaveBeenCalled();expect(host.querySelector('[role="alert"]')).toBeNull();expect(doc.activeElement===fora).toBe(true);
 await clicks(botao("Aprovar e enviar"));expect(mocks.aprovar).toHaveBeenCalledTimes(2);expect(mudou).toHaveBeenCalledOnce();
});it("434 ACK de rejeição após404→503 não atualiza histórico;200 recupera outra tentativa",async()=>{
 let resolver!:(r:Resultado)=>void;mocks.rejeitar.mockReturnValueOnce(new Promise(r=>{resolver=r;}));await render();await clicks(botao("Rejeitar"));await render("s",true);await render("s",true);await act(async()=>resolver({ok:true}));
 expect(mudou).not.toHaveBeenCalled();expect(host.textContent).toContain("Olá");expect(botao("Rejeitar").hasAttribute("disabled")).toBe(true);expect(botao("Aprovar e enviar").hasAttribute("disabled")).toBe(true);
 await render("s",false);await clicks(botao("Rejeitar"));expect(mocks.rejeitar).toHaveBeenCalledTimes(2);expect(mudou).toHaveBeenCalledOnce();
});
