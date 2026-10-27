import {expect,it} from "vitest";
import {atalhosDeHorario} from "@/lib/atalhos-horario";
import {atalhosDeAgendamento} from "./atalhos-agendamento";
const agora=new Date("2026-10-22T13:30:47.600Z");
it("oferece1h local mais os quatro atalhos D10 sem alterar os consumidores de tarefas",()=>{
 const antes=atalhosDeHorario(agora,"America/Sao_Paulo");const lista=atalhosDeAgendamento(agora,"America/Sao_Paulo");
 expect(lista.map(a=>a.rotulo)).toEqual(["Em 1 hora","Hoje 18:00","Amanhã 09:00","Amanhã 14:00","Segunda 09:00"]);
 expect(lista.slice(1)).toEqual(antes);expect(atalhosDeHorario(agora,"America/Sao_Paulo")).toEqual(antes);expect(antes.map(a=>a.id)).not.toContain("1h");
});
it("1h é instante+60min truncado no minuto no fuso do campo",()=>{
 expect(atalhosDeAgendamento(agora,"America/Sao_Paulo")[0]).toEqual({id:"1h",rotulo:"Em 1 hora",valorLocal:"2026-10-22T11:30"});
 expect(atalhosDeAgendamento(agora,"America/Costa_Rica")[0]?.valorLocal).toBe("2026-10-22T08:30");
});
it("hoje18 é estritamente futuro e segunda numa segunda é semana seguinte",()=>{
 expect(atalhosDeAgendamento(new Date("2026-10-22T21:00:00Z"),"America/Sao_Paulo").some(a=>a.id==="hoje18")).toBe(false);
 expect(atalhosDeAgendamento(new Date("2026-10-26T12:00Z"),"America/Sao_Paulo").find(a=>a.id==="seg9")?.valorLocal).toBe("2026-11-02T09:00");
});
it("1h em fold ambíguo é omitido e springforward conserva instante sem fabricar02h",()=>{
 expect(atalhosDeAgendamento(new Date("2026-11-01T04:30Z"),"America/New_York").some(a=>a.id==="1h")).toBe(false);
 expect(atalhosDeAgendamento(new Date("2026-03-08T06:30Z"),"America/New_York").find(a=>a.id==="1h")?.valorLocal).toBe("2026-03-08T03:30");
});
it("dia pulado de Apia não fabrica amanhã09 e inválidos não geram horário",()=>{
 expect(atalhosDeAgendamento(new Date("2011-12-29T22:00Z"),"Pacific/Apia").some(a=>a.id==="amanha9")).toBe(false);
 expect(atalhosDeAgendamento(new Date("invalida"),"UTC")).toEqual([]);expect(atalhosDeAgendamento(agora,"invalido")).toEqual([]);
});