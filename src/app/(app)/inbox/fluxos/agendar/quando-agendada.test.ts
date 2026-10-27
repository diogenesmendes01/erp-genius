import {expect,it} from "vitest";
import {quandoAgendada} from "./quando-agendada";
it("hoje, amanhã e data curta no fuso de exibição",()=>{
 const agora=new Date("2026-10-22T13:30:00Z");
 expect(quandoAgendada("2026-10-22T21:00:00Z","America/Sao_Paulo",agora)).toBe("Hoje às 18:00");
 expect(quandoAgendada("2026-10-23T12:00:00Z","America/Sao_Paulo",agora)).toBe("Amanhã às 09:00");
 expect(quandoAgendada("2026-10-26T12:00:00Z","America/Sao_Paulo",agora)).toBe("26/10 às 09:00");
});
it("o mesmo instante vira outro dia em Costa Rica",()=>{
 expect(quandoAgendada("2026-10-23T03:00:00Z","America/Costa_Rica",new Date("2026-10-22T13:30:00Z"))).toBe("Hoje às 21:00");
});
