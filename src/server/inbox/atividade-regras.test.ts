import {describe,expect,it} from "vitest";
import {Papel} from "@prisma/client";
import {autorDaAgendada,podeCancelarAgendadaInbox,type AgendadaParaCancelamento} from "./atividade-regras";
const vendedor={id:"v333",papeis:[Papel.VENDEDOR]},admin={id:"a333",papeis:[Papel.ADMINISTRADOR]},professor={id:"p333",papeis:[Papel.PROFESSOR]};
const agendada:AgendadaParaCancelamento={autorId:"v333",origem:"HUMANO",status:"PENDENTE",agendadaPara:new Date("2026-10-26T12:00Z"),passo:null,passoComercial:null};
describe("autoria é apresentação, não autorização",()=>{
 it("próprio humano, Aria mesmo com autor, outra pessoa e nome ausente",()=>{expect(autorDaAgendada("v333",{autorId:"v333",origem:"HUMANO",autorNome:"Ana"})).toEqual({tipo:"voce"});expect(autorDaAgendada("v333",{autorId:"v333",origem:"IA",autorNome:"Ana"})).toEqual({tipo:"aria"});expect(autorDaAgendada("v333",{autorId:"outro",origem:"CRON",autorNome:"Bia"})).toEqual({tipo:"pessoa",nome:"Bia"});expect(autorDaAgendada("v333",{autorId:null,origem:"CRON",autorNome:null})).toEqual({tipo:"pessoa",nome:"Sistema"});});
});
describe("cancelar Inbox preserva tarefas.ver e autoria; IA sóAdmin",()=>{
 it("próprio/Admin e outras origens explícitas; equipe não concede cancelar",()=>{expect(podeCancelarAgendadaInbox(vendedor,agendada)).toBe(true);expect(podeCancelarAgendadaInbox(admin,agendada)).toBe(true);expect(podeCancelarAgendadaInbox({...vendedor,papeis:[Papel.GERENTE_COMERCIAL]},{...agendada,autorId:"equipe"})).toBe(false);expect(podeCancelarAgendadaInbox(vendedor,{...agendada,origem:"CRON"})).toBe(true);});
 it("sem tarefas.ver não cancela nem a própria",()=>expect(podeCancelarAgendadaInbox(professor,{...agendada,autorId:professor.id})).toBe(false));
 it("IA não admite exceção de autor humano",()=>{expect(podeCancelarAgendadaInbox(vendedor,{...agendada,origem:"IA"})).toBe(false);expect(podeCancelarAgendadaInbox(admin,{...agendada,origem:"IA",autorId:null})).toBe(true);});
 it.each(["CANCELADA","ENVIANDO","DESPACHADA","FALHOU","SIMULADA"] as const)("estado %s não oferece cancelar",status=>expect(podeCancelarAgendadaInbox(admin,{...agendada,status})).toBe(false));
 it("ADIADA também permite; sem agenda ou com passo real não",()=>{expect(podeCancelarAgendadaInbox(vendedor,{...agendada,status:"ADIADA"})).toBe(true);expect(podeCancelarAgendadaInbox(admin,{...agendada,agendadaPara:null})).toBe(false);expect(podeCancelarAgendadaInbox(admin,{...agendada,passo:"D1"})).toBe(false);expect(podeCancelarAgendadaInbox(admin,{...agendada,passoComercial:"EXPERIMENTAL"})).toBe(false);});
});
describe("362 exceção GP somente com contexto servidor ativo e responsável",()=>{
 const gp={id:"gp",papeis:[Papel.GERENTE_PEDAGOGICO]},minha={...agendada,autorId:"gp"},contexto={ativo:true,responsavelId:"gp"};
 it("GP sem contexto mantém negativa333",()=>expect(podeCancelarAgendadaInbox(gp,minha)).toBe(false));
 it("GP própriaHUMANO recebe cancelar e replay gerível com contexto atual",()=>expect(podeCancelarAgendadaInbox(gp,minha,contexto)).toBe(true));
 it.each([{ativo:false,responsavelId:"gp"},{ativo:true,responsavelId:null},{ativo:true,responsavelId:"outro"}])("GP contexto revogado recusa %j",ctx=>expect(podeCancelarAgendadaInbox(gp,minha,ctx)).toBe(false));
 it("GP não ganha outraautoria/IA/CRON mesmo responsável",()=>{for(const patch of [{autorId:"outro"},{origem:"IA" as const},{origem:"CRON" as const}])expect(podeCancelarAgendadaInbox(gp,{...minha,...patch},contexto)).toBe(false);});
 it("professor não herda exceção de autor/responsável",()=>expect(podeCancelarAgendadaInbox({...gp,papeis:[Papel.PROFESSOR]},minha,contexto)).toBe(false));
});
