import { type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const m=vi.hoisted(()=>({g:null as null|import("@/test/tela-sem-dom").Ganchos}));
vi.mock("react",async original=>{const r=await original<typeof import("react")>();return {...r,useState:((i:unknown)=>m.g!.useState(i)) as typeof r.useState,useCallback:((f:unknown)=>f) as typeof r.useCallback};});
vi.mock("@/server/whatsapp/acoes-atendimento",()=>({assumirAtendimento:vi.fn(),devolverParaFila:vi.fn()}));
vi.mock("@/server/whatsapp/acoes-conversa",()=>({agendarMensagemNoAtendimentoLocal:vi.fn(),registrarNotaAtendimento:vi.fn(),cancelarAgendamentoDoAtendimento:vi.fn()}));
vi.mock("@/server/whatsapp/consultas-acoes-atendimento",()=>({listarConvitesEAgendamentos:vi.fn(),listarPessoasParaAtendimento:vi.fn()}));
vi.mock("@/server/whatsapp/operacoes-atendimento",()=>({encerrarAtendimentoWhatsApp:vi.fn()}));
vi.mock("@/server/whatsapp/preferencias",()=>({alternarFixada:vi.fn(),silenciarConversa:vi.fn(),marcarNaoLida:vi.fn()}));
vi.mock("@/components/SeloNaoLidasInbox",()=>({recontarNaoLidasInbox:vi.fn()}));
import { recontarNaoLidasInbox } from "@/components/SeloNaoLidasInbox";
import { criarGanchos, elementos } from "@/test/tela-sem-dom";
import { useAcoesAtendimento, type PropsAcoesAtendimento } from "./AcoesAtendimento";
import type { AcoesCabecalho } from "./MenuConversa";
import { marcarNaoLida } from "@/server/whatsapp/preferencias";
const p:PropsAcoesAtendimento & {aoBuscar():void}={atendimento:{id:"a",finalidade:"COMERCIAL",responsavelId:"u",status:"EM_ATENDIMENTO"},usuario:{id:"u",papeis:[Papel.VENDEDOR]},setoresDoNumero:["COMERCIAL"],fixada:false,silenciada:false,fuso:"America/Sao_Paulo",aoBuscar:vi.fn(),aoMudar:vi.fn()};
let atual:AcoesCabecalho;
function tela(props=p){m.g!.renderizar(()=>{atual=useAcoesAtendimento(props);return null as ReactNode;},{});return atual;}
beforeEach(()=>{m.g=criarGanchos();vi.clearAllMocks();});
it("render puro, feedback ausente e nota/agendar preservam contexto e fuso",()=>{
 let a=tela(); expect(marcarNaoLida).not.toHaveBeenCalled(); expect(a.feedback).toBeNull();
 a.menu.find(i=>i.id==="nota")!.aoEscolher(); a=tela(); expect(elementos(a.dialogos).find(n=>typeof n.type === "function" && n.type.name === "DialogoNota")?.props.atendimentoId).toBe("a");
 a.abrirAgendar!(); a=tela(); expect(elementos(a.dialogos).find(n=>typeof n.type === "function" && n.type.name === "DialogoAgendar")?.props).toMatchObject({atendimentoId:"a",fuso:"America/Sao_Paulo"});
});
it("não lida pessoal usa action existente; ocupado bloqueia menu até sucesso observado",async()=>{
 let resolver!:(r:{ok:true})=>void; vi.mocked(marcarNaoLida).mockReturnValue(new Promise(r=>{resolver=r;}));
 tela().menu.find(i=>i.id==="naoLida")!.aoEscolher();
 tela().menu.find(i=>i.id==="naoLida")!.aoEscolher();
 expect(marcarNaoLida).toHaveBeenCalledWith("a"); expect(marcarNaoLida).toHaveBeenCalledOnce(); expect(tela().menu.every(i=>i.desabilitado)).toBe(true);
 resolver({ok:true}); await new Promise(r=>setTimeout(r,0));
 expect(p.aoMudar).toHaveBeenCalledOnce(); expect(recontarNaoLidasInbox).toHaveBeenCalledOnce(); expect(tela().feedback).not.toBeNull();
});
it("grupo mantém pessoais sem negócios; encerrado não permite abrir agendamento",()=>{
 expect(tela({...p,grupo:true}).menu.map(i=>i.id)).toEqual(["naoLida","fixar","silenciar","buscar"]);
 m.g!.reiniciar(); expect(tela({...p,atendimento:{...p.atendimento,status:"ENCERRADO"}}).abrirAgendar).toBeNull();
});

it("falha na preferência não invalida contador nem reconcilia como sucesso",async()=>{
 vi.mocked(marcarNaoLida).mockResolvedValue({ok:false,erro:"Permissão alterada"});
 tela().menu.find(i=>i.id==="naoLida")!.aoEscolher(); await new Promise(r=>setTimeout(r,0));
 expect(recontarNaoLidasInbox).not.toHaveBeenCalled(); expect(p.aoMudar).not.toHaveBeenCalled(); expect(tela().feedback).not.toBeNull();
});
