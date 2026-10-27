import {expect,it,vi} from "vitest";
vi.mock("@/server/whatsapp/consultas-acoes-atendimento",()=>({agendadasDoAtendimento:vi.fn()}));
import {avisoRecarregaAgendadas,ordenarAgendadas} from "./useAgendadas";
import type {AgendadaNoFio} from "@/server/inbox/agendadas-leitura";
const a=(id:string,agendadaPara:string):AgendadaNoFio=>({id,texto:id,agendadaPara,status:"PENDENTE",tipo:"TEXTO",temAnexo:false,autor:"voce",autorNome:null,podeAlterar:true,perguntaPendente:false});
it("ordena por agendadaPara e desempata por id sem mutar a entrada",()=>{
 const entrada=[a("c","2026-10-24T12:00Z"),a("b","2026-10-23T12:00:00.000Z"),a("a","2026-10-23T12:00Z")];
 expect(ordenarAgendadas(entrada).map(x=>x.id)).toEqual(["a","b","c"]);
 expect(entrada.map(x=>x.id)).toEqual(["c","b","a"]);
});
it("recarrega com qualquer aviso do atendimento aberto ou resync; ignora outros e sem seleção",()=>{
 const aviso=(tipo:"atendimento.atualizado"|"mensagem.nova"|"mensagem.status"|"resync"|"aria.global",atendimentoId:string|null)=>({tipo,atendimentoId,mensagemId:null,conversaId:"cv"});
 expect(avisoRecarregaAgendadas(aviso("atendimento.atualizado","a1"),"a1")).toBe(true);
 expect(avisoRecarregaAgendadas(aviso("mensagem.nova","a1"),"a1")).toBe(true);
 expect(avisoRecarregaAgendadas(aviso("resync",null),"a1")).toBe(true);
 expect(avisoRecarregaAgendadas(aviso("atendimento.atualizado","a2"),"a1")).toBe(false);
 expect(avisoRecarregaAgendadas(aviso("aria.global",null),"a1")).toBe(false);
 expect(avisoRecarregaAgendadas(aviso("atendimento.atualizado",null),null)).toBe(false);
});
