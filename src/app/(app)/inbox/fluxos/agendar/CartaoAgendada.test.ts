import {readFileSync} from "node:fs";
import {act,createElement} from "react";
import type {Root} from "react-dom/client";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {criarDomMinimo,desligarObservadores,type Elemento} from "@/test/dom-minimo";
import type {AgendadaNoFio} from "@/server/inbox/agendadas-leitura";
const m=vi.hoisted(()=>({enviar:vi.fn(),cancelar:vi.fn(),manter:vi.fn()}));
vi.mock("@/server/whatsapp/acoes-conversa",()=>({enviarAgendamentoAgoraDoAtendimento:m.enviar,cancelarAgendamentoDoAtendimento:m.cancelar,manterAgendadaAposResposta:m.manter}));
vi.mock("@tabler/icons-react",()=>Object.fromEntries(["IconClock","IconPaperclip","IconPencil","IconSend","IconX"].map(k=>[k,()=>null])));
vi.mock("@/components/ConfirmarAcao",async()=>{const {createElement:h}=await import("react");return {ConfirmarAcao:(p:{titulo:string;acao():Promise<{ok:boolean}>;aoConcluir():void;aoCancelar():void})=>h("div",{role:"alertdialog","aria-label":p.titulo},h("button",{onClick:async()=>{const r=await p.acao();if(r.ok)p.aoConcluir();}},"Confirmar cancelamento"),h("button",{onClick:p.aoCancelar},"Voltar"))};});
import {CartaoAgendada,type PropsCartaoAgendada} from "./CartaoAgendada";
const agora=new Date("2026-10-22T13:30:00Z");
const base:AgendadaNoFio={id:"i1",texto:"Lembrete da visita",agendadaPara:"2026-10-23T12:00:00.000Z",status:"PENDENTE",tipo:"TEXTO",temAnexo:false,autor:"voce",autorNome:"Ana",podeAlterar:true,perguntaPendente:false};
let root:Root,host:Elemento;const editar=vi.fn(),mudar=vi.fn();
function eventos(e:Elemento){const k=Object.keys(e).find(k=>k.startsWith("__reactProps"))!;return (e as unknown as Record<string,{onClick(e?:unknown):unknown;disabled?:boolean}>)[k];}
const botoes=()=>host.querySelectorAll("button").map(b=>b.textContent);
const botao=(t:string)=>{const b=host.querySelectorAll("button").find(b=>b.textContent===t);expect(b,`botão ${t}`).toBeDefined();return b!;};
const clicar=(t:string)=>act(async()=>{await eventos(botao(t)).onClick({currentTarget:botao(t)});});
function props(p:Partial<PropsCartaoAgendada>={}):PropsCartaoAgendada{return {agendada:base,atendimentoId:"a1",nomeContato:"Carla",fuso:"America/Sao_Paulo",agora,aoEditar:editar,aoMudar:mudar,...p};}
const render=(p:Partial<PropsCartaoAgendada>={})=>act(async()=>root.render(createElement(CartaoAgendada,props(p))));
beforeEach(async()=>{vi.resetAllMocks();m.enviar.mockResolvedValue({ok:true,dado:{id:"i1"}});m.cancelar.mockResolvedValue({ok:true});m.manter.mockResolvedValue({ok:true,dado:{id:"i1"}});const d=criarDomMinimo();vi.stubGlobal("document",d.documento);vi.stubGlobal("window",d.janela);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);host=d.documento.createElement("div");d.documento.body.appendChild(host);const {createRoot}=await import("react-dom/client");root=createRoot(host as unknown as HTMLElement);});
afterEach(async()=>{await act(async()=>root.unmount());desligarObservadores();vi.unstubAllGlobals();});
it("da própria pessoa: 'Agendada para Amanhã às 09:00', 'por você' e os três botões",async()=>{
 await render();
 expect(host.textContent).toContain("Agendada para Amanhã às 09:00");
 expect(host.textContent).toContain("por você");
 expect(host.textContent).toContain("Lembrete da visita");
 expect(botoes()).toEqual(["Editar","Enviar agora","Cancelar"]);
 expect(host.querySelector("article")!.getAttribute("class")).toContain("border-dashed");
});
it("da Aria: 'por Aria' em --ai, sem botões",async()=>{
 await render({agendada:{...base,autor:"aria",autorNome:null,podeAlterar:false}});
 const autoria=host.querySelectorAll("span").find(s=>s.textContent==="por Aria");
 expect(autoria?.getAttribute("class")).toContain("text-ai-700");
 expect(botoes()).toEqual([]);
});
it("Aria nunca recebe ações, mesmo com podeAlterar vindo verdadeiro",async()=>{
 await render({agendada:{...base,autor:"aria",autorNome:null,podeAlterar:true}});
 expect(botoes()).toEqual([]);
});
it("de colega: 'por {nome}'",async()=>{
 await render({agendada:{...base,autor:"equipe",autorNome:"Bruno",podeAlterar:false}});
 expect(host.textContent).toContain("por Bruno");
});
it("sem podeAlterar: só leitura",async()=>{
 await render({agendada:{...base,podeAlterar:false}});
 expect(host.textContent).toContain("Lembrete da visita");
 expect(botoes()).toEqual([]);
});
it("sem controlador de agendamento, Editar some e os demais ficam",async()=>{
 await render({aoEditar:undefined});
 expect(botoes()).toEqual(["Enviar agora","Cancelar"]);
});
it("Editar repassa o botão como âncora do popover",async()=>{
 await render();await clicar("Editar");
 expect(editar).toHaveBeenCalledOnce();expect(editar.mock.calls[0][0]).toBe(botao("Editar"));
});
it("Enviar agora chama enviarAgendamentoAgoraDoAtendimento com a chave e avisa 'Mensagem enviada.'",async()=>{
 await render();await clicar("Enviar agora");
 expect(m.enviar).toHaveBeenCalledExactlyOnceWith({atendimentoId:"a1",intencaoId:"i1",chaveIdempotencia:expect.any(String)});
 expect(mudar).toHaveBeenCalledExactlyOnceWith("Mensagem enviada.");
});
it("Enviar agora com erro mantém o cartão e repete a mesma chave na nova tentativa",async()=>{
 m.enviar.mockResolvedValueOnce({ok:false,erro:"Assuma a conversa para enviar."});
 await render();await clicar("Enviar agora");
 expect(host.textContent).toContain("Assuma a conversa para enviar.");expect(mudar).not.toHaveBeenCalled();
 await clicar("Enviar agora");
 expect(m.enviar).toHaveBeenCalledTimes(2);expect(m.enviar.mock.calls[1][0].chaveIdempotencia).toBe(m.enviar.mock.calls[0][0].chaveIdempotencia);
 expect(mudar).toHaveBeenCalledExactlyOnceWith("Mensagem enviada.");
});
it("resposta de Enviar agora após trocar de atendimento não avisa",async()=>{
 let fim!:(r:{ok:true})=>void;m.enviar.mockImplementation(()=>new Promise(r=>{fim=r;}));
 await render();await act(async()=>{void eventos(botao("Enviar agora")).onClick();});
 await render({atendimentoId:"a2"});await act(async()=>fim({ok:true}));
 expect(mudar).not.toHaveBeenCalled();
});
it("Cancelar pede confirmação antes de cancelar e avisa ao concluir",async()=>{
 await render();await clicar("Cancelar");
 expect(host.querySelector('[role="alertdialog"]')?.getAttribute("aria-label")).toBe("Cancelar esta mensagem agendada?");
 expect(m.cancelar).not.toHaveBeenCalled();
 await clicar("Confirmar cancelamento");
 expect(m.cancelar).toHaveBeenCalledExactlyOnceWith({atendimentoId:"a1",intencaoId:"i1"});
 expect(mudar).toHaveBeenCalledExactlyOnceWith("Mensagem agendada cancelada.");
 expect(host.querySelector('[role="alertdialog"]')).toBeNull();
});
it("Voltar na confirmação não cancela",async()=>{
 await render();await clicar("Cancelar");await clicar("Voltar");
 expect(m.cancelar).not.toHaveBeenCalled();expect(host.querySelector('[role="alertdialog"]')).toBeNull();
});
it("Cancelar só roda dentro da prop `acao` de um ConfirmarAcao (fonte)",()=>{
 const fonte=readFileSync("src/app/(app)/inbox/fluxos/agendar/CartaoAgendada.tsx","utf8");
 expect(fonte).toMatch(/<ConfirmarAcao[\s\S]*acao=\{\(\) => cancelarAgendamentoDoAtendimento\(/);
 expect(fonte.match(/cancelarAgendamentoDoAtendimento\(/g)).toHaveLength(1);
});
it("com anexo: mostra o anexo acima do texto",async()=>{
 await render({agendada:{...base,tipo:"DOCUMENTO",temAnexo:true}});
 const ps=host.querySelectorAll("p").map(p=>p.textContent);
 const anexo=ps.findIndex(t=>t==="Anexo · Documento"),texto=ps.findIndex(t=>t==="Lembrete da visita");
 expect(anexo).toBeGreaterThanOrEqual(0);expect(anexo).toBeLessThan(texto);
});
it("CartaoAgendada com perguntaPendente mostra a pergunta e os dois botões",async()=>{
 await render({agendada:{...base,perguntaPendente:true}});
 expect(host.textContent).toContain("Carla respondeu depois que você agendou. Ainda quer enviar?");
 expect(botoes()).toEqual(["Cancelar envio","Manter agendada"]);
});
it("Manter agendada chama manterAgendadaAposResposta com a chave e avisa",async()=>{
 await render({agendada:{...base,perguntaPendente:true}});await clicar("Manter agendada");
 expect(m.manter).toHaveBeenCalledExactlyOnceWith({atendimentoId:"a1",intencaoId:"i1",chaveIdempotencia:expect.any(String)});
 expect(mudar).toHaveBeenCalledExactlyOnceWith("Mensagem mantida agendada.");
});
it("Manter agendada com erro mostra o motivo e repete a mesma chave",async()=>{
 m.manter.mockResolvedValueOnce({ok:false,erro:"Assuma a conversa para alterar a mensagem agendada."});
 await render({agendada:{...base,perguntaPendente:true}});await clicar("Manter agendada");
 expect(host.textContent).toContain("Assuma a conversa para alterar a mensagem agendada.");expect(mudar).not.toHaveBeenCalled();
 await clicar("Manter agendada");expect(m.manter.mock.calls[1][0].chaveIdempotencia).toBe(m.manter.mock.calls[0][0].chaveIdempotencia);
});
it("Cancelar envio pede a confirmação de cancelamento",async()=>{
 await render({agendada:{...base,perguntaPendente:true}});await clicar("Cancelar envio");
 expect(host.querySelector('[role="alertdialog"]')?.getAttribute("aria-label")).toBe("Cancelar esta mensagem agendada?");
 await clicar("Confirmar cancelamento");
 expect(m.cancelar).toHaveBeenCalledExactlyOnceWith({atendimentoId:"a1",intencaoId:"i1"});
 expect(mudar).toHaveBeenCalledExactlyOnceWith("Mensagem agendada cancelada.");
});
it("pergunta pendente de colega sem alçada: só o aviso, sem botões",async()=>{
 await render({agendada:{...base,autor:"equipe",autorNome:"Bruno",podeAlterar:false,perguntaPendente:true}});
 expect(host.textContent).toContain("Carla respondeu depois do agendamento. A mensagem aguarda confirmação para ser enviada.");
 expect(botoes()).toEqual([]);
});
it("pergunta sem nome do contato usa 'O contato'",async()=>{
 await render({nomeContato:null,agendada:{...base,autor:"equipe",perguntaPendente:true}});
 expect(host.textContent).toContain("O contato respondeu depois do agendamento. Ainda quer enviar?");
});
