import {expect,it} from "vitest";
import {agendadaProxima} from "./conflito";
const q=new Date("2035-01-01T12:00Z");const a=(id:string,agendadaPara:string)=>({id,agendadaPara});
it.each(["2035-01-01T10:01Z","2035-01-01T13:59Z"])("menos2h em ambos sentidos apenas informa%s",iso=>expect(agendadaProxima(q,[a("x",iso)])).toEqual(a("x",iso)));
it.each(["2035-01-01T10:00Z","2035-01-01T14:00Z"])("2h exatas não conflitam%s",iso=>expect(agendadaProxima(q,[a("x",iso)])).toBeNull());
it("ignora próprioid e seleciona próximo com desempate id determinístico",()=>{
 const linhas=[a("propria",q.toISOString()),a("z","2035-01-01T11:00Z"),a("b","2035-01-01T13:00Z")];
 expect(agendadaProxima(q,linhas,"propria")).toEqual(linhas[2]);expect(agendadaProxima(q,[...linhas].reverse(),"propria")).toEqual(linhas[2]);
});
it("inválidos/lista vazia retornamnull sem fabricar conflito",()=>{expect(agendadaProxima(q,[a("x","invalida")])).toBeNull();expect(agendadaProxima(new Date("invalida"),[a("x",q.toISOString())])).toBeNull();expect(agendadaProxima(q,[])).toBeNull();});