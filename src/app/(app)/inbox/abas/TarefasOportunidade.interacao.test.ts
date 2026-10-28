import {act,createElement} from "react";
import type {Root} from "react-dom/client";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {criarDomMinimo,desligarObservadores,type Elemento} from "@/test/dom-minimo";
const {concluir,reabrir,reagendar,cancelar}=vi.hoisted(()=>({concluir:vi.fn(),reabrir:vi.fn(),reagendar:vi.fn(),cancelar:vi.fn()}));
vi.mock("@/server/inbox/acoes-painel",()=>({concluirTarefaNoInbox:concluir,reabrirTarefaNoInbox:reabrir,reagendarTarefaNoInbox:reagendar,cancelarTarefaNoInbox:cancelar}));
vi.mock("@tabler/icons-react",()=>({IconCalendarTime:()=>createElement("span"),IconPencil:()=>createElement("span"),IconTrash:()=>createElement("span")}));
import {TarefasOportunidade} from "./TarefasOportunidade";
import type {TarefaPainel} from "@/server/inbox/painel-tarefas";
const tarefa:TarefaPainel={id:"t330",versao:1,titulo:"Retorno fictício330",descricao:null,tipo:"LIGACAO",status:"ABERTA",prioridade:"NORMAL",dataCivil:null,hora:null,fusoOrigem:"America/Sao_Paulo",lembreteAntecedenciaMin:null,responsavel:null,atrasada:false,ia:false,leadId:null,atendimentoId:"a330",criadoEm:"2026-10-20T12:00:00Z",criadorNome:null,podeAgir:true};
let root:Root,host:Elemento,pagina:Elemento;
const mudar=vi.fn(),teclas=new Set<(e:KeyboardEvent)=>void>();
const renderLista=(tarefas:TarefaPainel[],atendimentoId="a330")=>act(async()=>root.render(createElement(TarefasOportunidade,{atendimentoId,tarefas,fusoEscola:"America/Sao_Paulo",fuso:"America/Costa_Rica",podeCriar:false,aoMudar:mudar})));
const render=(atendimentoId="a330",t=tarefa)=>act(async()=>root.render(createElement(TarefasOportunidade,{atendimentoId,tarefas:[t],fusoEscola:"America/Sao_Paulo",fuso:"America/Costa_Rica",podeCriar:false,aoMudar:mudar})));
function prop(e:Elemento,n:string,arg?:unknown){const k=Object.keys(e).find(k=>k.startsWith("__reactProps"));const direto=k?(e as unknown as Record<string,Record<string,(a?:unknown)=>unknown>>)[k]:undefined;if(typeof direto?.[n]==="function"){direto[n](arg);return;}const fk=Object.keys(e).find(k=>k.startsWith("__reactFiber"));let f=fk?(e as unknown as Record<string,{return?:unknown;memoizedProps?:Record<string,unknown>}>)[fk]:undefined;while(f){const fn=f.memoizedProps?.[n];if(typeof fn==="function"){(fn as (a?:unknown)=>void)(arg);return;}f=f.return as typeof f;}throw new Error("sem "+n);}
const btn=(texto:string)=>pagina.querySelectorAll("button").find(b=>b.textContent===texto)!;
const gatilho=()=>host.querySelectorAll("button").find(b=>b.getAttribute("title")==="Cancelar tarefa")!;
const abrir=()=>act(async()=>prop(gatilho(),"onClick"));
const clicar=(texto:string)=>act(async()=>prop(btn(texto),"onClick"));
async function revisar(m="Cliente pediu"){await act(async()=>prop(pagina.querySelector("textarea")!,"onChange",{target:{value:m}}));}
beforeEach(async()=>{
 vi.clearAllMocks();teclas.clear();for(const f of [concluir,reabrir,reagendar,cancelar])f.mockResolvedValue({ok:true});
 const d=criarDomMinimo();pagina=d.documento.body;Object.assign(d.documento,{addEventListener(t:string,f:(e:KeyboardEvent)=>void){if(t==="keydown")teclas.add(f);},removeEventListener(t:string,f:(e:KeyboardEvent)=>void){if(t==="keydown")teclas.delete(f);}});
 vi.stubGlobal("document",d.documento);vi.stubGlobal("window",d.janela);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
 host=d.documento.createElement("div");pagina.appendChild(host);const {createRoot}=await import("react-dom/client");root=createRoot(host as unknown as HTMLElement);
});
afterEach(async()=>{await act(async()=>root.unmount());desligarObservadores();vi.unstubAllGlobals();});
it("concluir trava clique duplo antes de rerender e recarrega só após ACK",async()=>{
 let fim!:(r:{ok:true})=>void;concluir.mockImplementation(()=>new Promise(r=>fim=r));await render();
 await act(async()=>{prop(host.querySelector('[role="checkbox"]')!,"onCheckedChange");prop(host.querySelector('[role="checkbox"]')!,"onCheckedChange");});
 expect(concluir).toHaveBeenCalledExactlyOnceWith("a330","t330",1);expect(mudar).not.toHaveBeenCalled();
 await act(async()=>fim({ok:true}));expect(mudar).toHaveBeenCalledOnce();
});
it("reabrir concluída não depende de podeAgir das abertas",async()=>{await render("a330",{...tarefa,status:"CONCLUIDA",podeAgir:false});await act(async()=>prop(host.querySelector('[role="checkbox"]')!,"onCheckedChange"));expect(reabrir).toHaveBeenCalledExactlyOnceWith("a330","t330",1);});
it("erro de versão fica visível e pede atualização",async()=>{concluir.mockResolvedValue({ok:false,erro:"Esta tarefa foi alterada por outra pessoa. Recarregue."});await render();await act(async()=>prop(host.querySelector('[role="checkbox"]')!,"onCheckedChange"));expect(host.textContent).toContain("Esta tarefa foi alterada por outra pessoa. Recarregue.");expect(mudar).toHaveBeenCalledOnce();});
it("cancelar exige motivo e confirmação real; Voltar não chama action",async()=>{await render();gatilho().focus();await abrir();expect(pagina.querySelector('[role="alertdialog"]')).toBeTruthy();expect(btn("Confirmar cancelamento").hasAttribute("disabled")).toBe(true);await clicar("Confirmar cancelamento");expect(cancelar).not.toHaveBeenCalled();await clicar("Voltar");expect(pagina.querySelector("textarea")).toBeNull();expect(cancelar).not.toHaveBeenCalled();});
it("confirmação final recebe motivo normalizado, foco seguro, busy e duplo clique único",async()=>{
 let fim!:(r:{ok:true})=>void;cancelar.mockImplementation(()=>new Promise(r=>fim=r));await render();await abrir();await revisar("  Cliente pediu  ");
 expect(pagina.querySelector('[role="alertdialog"]')).toBeTruthy();expect(btn("Voltar")).toBeTruthy();expect(cancelar).not.toHaveBeenCalled();
 await act(async()=>{prop(btn("Confirmar cancelamento"),"onClick");prop(btn("Confirmar cancelamento"),"onClick");});expect(cancelar).toHaveBeenCalledExactlyOnceWith("a330","t330",1,"Cliente pediu");expect(btn("Confirmando…").hasAttribute("disabled")).toBe(true);
 await revisar("Alterado durante execução");await act(async()=>prop(btn("Confirmando…"),"onClick"));expect(cancelar).toHaveBeenCalledExactlyOnceWith("a330","t330",1,"Cliente pediu");
 await act(async()=>fim({ok:true}));expect(mudar).toHaveBeenCalledOnce();expect(pagina.querySelector('[role="alertdialog"]')).toBeNull();
});
it("falha de transporte mantém confirmação sem retry automático",async()=>{cancelar.mockRejectedValue(Error("rede"));await render();await abrir();await revisar();await clicar("Confirmar cancelamento");expect(pagina.querySelector('[role="alertdialog"]')).toBeTruthy();expect(cancelar).toHaveBeenCalledOnce();expect(mudar).not.toHaveBeenCalled();});
it("ACK A→B→A antigo não fecha nova abertura nem atualiza outra sessão",async()=>{
 let fim!:(r:{ok:true})=>void;cancelar.mockImplementation(()=>new Promise(r=>fim=r));await render();await abrir();await revisar();await clicar("Confirmar cancelamento");
 await render("b330");await render();await abrir();await revisar("Novo motivo");await act(async()=>fim({ok:true}));
 expect(pagina.querySelector('[role="alertdialog"]')).toBeTruthy();expect((pagina.querySelector("textarea")! as unknown as {value:string}).value).toBe("Novo motivo");expect(mudar).not.toHaveBeenCalled();expect(cancelar).toHaveBeenCalledOnce();
});
it("amanhã é resolvido no clique, mesmo se o painel atravessa a meia-noite",async()=>{
 vi.useFakeTimers({toFake:["Date"]});try{
  vi.setSystemTime(new Date("2026-10-23T02:59:00Z"));await render();
  vi.setSystemTime(new Date("2026-10-23T03:01:00Z"));
  const b=host.querySelectorAll("button").find(b=>b.getAttribute("title")==="Reagendar para amanhã 09:00")!;
  await act(async()=>prop(b,"onClick"));
  expect(reagendar).toHaveBeenCalledExactlyOnceWith("a330","t330",1,{dataCivil:"2026-10-24",hora:"09:00",fusoEscolaEsperado:"America/Sao_Paulo"});
 }finally{vi.useRealTimers();}
});
it("fuso institucional alterado recusa e pede recarregar o painel",async()=>{
 reagendar.mockResolvedValue({ok:false,erro:"O fuso da escola mudou ou está indisponível. Recarregue o painel."});await render();
 const b=host.querySelectorAll("button").find(b=>b.getAttribute("title")==="Reagendar para amanhã 09:00")!;await act(async()=>prop(b,"onClick"));
 expect(host.textContent).toContain("O fuso da escola mudou");expect(mudar).toHaveBeenCalledOnce();
});
it("refresh de outra tarefa preserva o mesmo campo e motivo digitado",async()=>{
 const outra={...tarefa,id:"outra330",titulo:"Outra tarefa"};await renderLista([tarefa,outra]);await abrir();await revisar("Motivo preservado");const campo=pagina.querySelector("textarea");
 await renderLista([{...tarefa},{...outra,versao:2}]);
 expect(pagina.querySelector("textarea")).toBe(campo);expect((campo as unknown as {value:string}).value).toBe("Motivo preservado");expect(btn("Confirmar cancelamento").hasAttribute("disabled")).toBe(false);
 await clicar("Confirmar cancelamento");expect(cancelar).toHaveBeenCalledExactlyOnceWith("a330","t330",1,"Motivo preservado");
});
it("alvo atualizado conserva motivo quando a própria tentativa é recusada por versão",async()=>{
 let fim!:(r:{ok:false;erro:string})=>void;cancelar.mockImplementation(()=>new Promise(r=>fim=r));await render();await abrir();await revisar("Motivo do alvo");await clicar("Confirmar cancelamento");
 const campo=pagina.querySelector("textarea");await render("a330",{...tarefa,versao:2});
 expect(pagina.querySelector("textarea")).toBe(campo);expect((campo as unknown as {value:string}).value).toBe("Motivo do alvo");
 await act(async()=>fim({ok:false,erro:"Esta tarefa foi alterada por outra pessoa. Recarregue."}));expect(mudar).toHaveBeenCalledOnce();expect(pagina.querySelector('[role="alertdialog"]')).toBeTruthy();expect(btn("Confirmar cancelamento").hasAttribute("disabled")).toBe(true);
});
it("alvo removido conserva rascunho e recusa de permissão não fecha diálogo",async()=>{
 let fim!:(r:{ok:false;erro:string})=>void;cancelar.mockImplementation(()=>new Promise(r=>fim=r));await render();await abrir();await revisar("Não perder");await clicar("Confirmar cancelamento");await renderLista([]);
 await act(async()=>fim({ok:false,erro:"Você não tem acesso a esta função do CRM."}));expect(mudar).not.toHaveBeenCalled();expect((pagina.querySelector("textarea") as unknown as {value:string}).value).toBe("Não perder");expect(btn("Confirmar cancelamento").hasAttribute("disabled")).toBe(true);expect(cancelar).toHaveBeenCalledOnce();
});
it("ACK de cancelamento vigente continua válido após refresh de outra tarefa",async()=>{
 let fim!:(r:{ok:true})=>void;cancelar.mockImplementation(()=>new Promise(r=>fim=r));const outra={...tarefa,id:"outra330"};await renderLista([tarefa,outra]);await abrir();await revisar("Alvo vigente");await clicar("Confirmar cancelamento");
 await renderLista([{...tarefa},{...outra,versao:2}]);await act(async()=>fim({ok:true}));
 expect(mudar).toHaveBeenCalledOnce();expect(pagina.querySelector('[role="alertdialog"]')).toBeNull();expect(cancelar).toHaveBeenCalledExactlyOnceWith("a330","t330",1,"Alvo vigente");
});
it("ACK de conclusão do alvo atualizado não reconcilia outra versão",async()=>{
 let fim!:(r:{ok:true})=>void;concluir.mockImplementation(()=>new Promise(r=>fim=r));await render();await act(async()=>prop(host.querySelector('[role="checkbox"]')!,"onCheckedChange"));await render("a330",{...tarefa,versao:2});await act(async()=>fim({ok:true}));expect(mudar).not.toHaveBeenCalled();
});
it("alvo removido e reapresentado não reabilita a abertura invalidada",async()=>{
 await render();await abrir();await revisar("Preservado mesmo assim");const campo=pagina.querySelector("textarea");await renderLista([]);await render();
 expect(pagina.querySelector("textarea")).toBe(campo);expect((campo as unknown as {value:string}).value).toBe("Preservado mesmo assim");expect(btn("Confirmar cancelamento").hasAttribute("disabled")).toBe(true);
 await clicar("Confirmar cancelamento");expect(cancelar).not.toHaveBeenCalled();
});
it("refresh próprio antes do ACK de sucesso não exibe obsolescência nem deixa diálogo aberto",async()=>{
 let fim!:(r:{ok:true})=>void;cancelar.mockImplementation(()=>new Promise(r=>fim=r));await render();await abrir();await revisar("Cliente pediu");await clicar("Confirmar cancelamento");
 await renderLista([]);expect(pagina.textContent).not.toContain("Esta tarefa foi alterada por outra pessoa.");expect(btn("Confirmando…")).toBeTruthy();
 await act(async()=>fim({ok:true}));expect(mudar).toHaveBeenCalledOnce();expect(pagina.querySelector('[role="alertdialog"]')).toBeNull();
});
it.each([403,404])("revogação %s desmonta a sessão e ACK antigo não reconcilia",async status=>{
 let fim!:(r:{ok:true})=>void;cancelar.mockImplementation(()=>new Promise(r=>fim=r));await render();await abrir();await revisar();await clicar("Confirmar cancelamento");await act(async()=>root.render(createElement("p",null,"Sem acesso "+status)));await act(async()=>fim({ok:true}));expect(mudar).not.toHaveBeenCalled();expect(pagina.querySelector('[role="alertdialog"]')).toBeNull();
});
it("resultado incerto após refresh preserva motivo sem converter em sucesso",async()=>{
 let falhar!:(e:Error)=>void;cancelar.mockImplementation(()=>new Promise((_r,reject)=>falhar=reject));await render();await abrir();await revisar("Motivo incerto");await clicar("Confirmar cancelamento");await renderLista([]);await act(async()=>falhar(Error("rede")));expect(mudar).not.toHaveBeenCalled();expect((pagina.querySelector("textarea")! as unknown as {value:string}).value).toBe("Motivo incerto");expect(btn("Confirmar cancelamento").hasAttribute("disabled")).toBe(true);
});
it("concluir com mensagem pergunta e envia manter; cancelar exige a escolha",async()=>{
 const com={...tarefa,mensagemAgendada:{id:"m",status:"ADIADA" as const,agendadaPara:"2026-10-29T13:00:00.000Z",quando:"29/10 10:00"}};
 await render("a330",com);expect(host.textContent).toContain("Mensagem agendada · 29/10 10:00");
 await act(async()=>prop(host.querySelector('[role="checkbox"]')!,"onCheckedChange"));expect(concluir).not.toHaveBeenCalled();
 const manter=pagina.querySelectorAll("button").find(b=>b.textContent==="Manter o envio agendado")!;await act(async()=>prop(manter,"onClick"));
 expect(concluir).toHaveBeenCalledExactlyOnceWith("a330","t330",1,"manter");
 await render("a330",com);await abrir();await revisar("Cliente pediu");expect(btn("Confirmar cancelamento").hasAttribute("disabled")).toBe(true);
 const radio=pagina.querySelectorAll('[role="radio"]').find(e=>e.getAttribute("value")==="cancelar")!;await act(async()=>{const fk=Object.keys(radio).find(k=>k.startsWith("__reactFiber"))!;let f=(radio as unknown as Record<string,{return?:unknown;memoizedProps?:Record<string,unknown>}>)[fk];while(f&&typeof f.memoizedProps?.onValueChange!=="function")f=f.return as typeof f;(f!.memoizedProps!.onValueChange as (v:string)=>void)("cancelar");});
 await clicar("Confirmar cancelamento");expect(cancelar).toHaveBeenCalledExactlyOnceWith("a330","t330",1,"Cliente pediu","cancelar");
});
it("fechar superfície e reabrir mesma conversa invalida o ACK da abertura anterior",async()=>{
 let fim!:(r:{ok:true})=>void;cancelar.mockImplementation(()=>new Promise(r=>fim=r));await render();await abrir();await revisar("Tentativa antiga");await clicar("Confirmar cancelamento");await act(async()=>root.render(null));await render();await abrir();await revisar("Abertura nova");await act(async()=>fim({ok:true}));expect(mudar).not.toHaveBeenCalled();expect((pagina.querySelector("textarea")! as unknown as {value:string}).value).toBe("Abertura nova");expect(pagina.querySelector('[role="alertdialog"]')).toBeTruthy();
});