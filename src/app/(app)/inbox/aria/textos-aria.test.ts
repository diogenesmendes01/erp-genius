import { expect, it } from "vitest";
import { haQuanto, linhaEstadoAria, textoPausaAria } from "./textos-aria";
const o = { atendidoPorVoce: false, responsavelNome: null, podeDecidir: false, pausada: false, motivo: null };
it("estado da Aria usa capacidade real e não presume aprovação", () => {
 expect(linhaEstadoAria("ia",o)).toEqual({tom:"ia",texto:"Aria está atendendo",dica:null});
 expect(linhaEstadoAria("aprovacao",o)?.texto).toBe("Aria aguarda aprovação");
 expect(linhaEstadoAria("aprovacao",{...o,podeDecidir:true})?.texto).toBe("Aria aguarda sua aprovação");
 expect(linhaEstadoAria("handoff",{...o,pausada:true,motivo:"HANDOFF"})).toEqual({tom:"handoff",texto:"Aria pediu um humano",dica:"Aria pausada · Transferido para humano"});
 expect(linhaEstadoAria(null,o)).toBeNull();
});
it.each([[true,"Camila Souza","Você está atendendo"],[false,"  Camila   Souza ","Camila está atendendo"],[false,null,"Uma pessoa está atendendo"],[false,"   ","Uma pessoa está atendendo"]])("humano resolve identidade %s/%s",(atendidoPorVoce,responsavelNome,texto)=>expect(linhaEstadoAria("humano",{...o,atendidoPorVoce:atendidoPorVoce as boolean,responsavelNome:responsavelNome as string|null})?.texto).toBe(texto));
it.each([[null,"Aria pausada"],["HUMANO_RESPONDEU","Aria pausada · Humano respondeu no ERP"],["CELULAR","Aria pausada · Resposta pelo celular"],["MANUAL","Aria pausada · Pausa manual"],["HANDOFF","Aria pausada · Transferido para humano"],["OPT_OUT","Aria pausada · Contato pediu para parar"]] as const)("pausa preserva motivo %s",(motivo,texto)=>expect(textoPausaAria(motivo)).toBe(texto));
it("motivo antigo sem pausa não vira title",()=>expect(linhaEstadoAria("ia",{...o,motivo:"MANUAL"})?.dica).toBeNull());
const agora = new Date("2026-10-25T12:00:00Z");
it.each([[0,"agora"],[59000,"agora"],[60000,"há 1 min"],[3599999,"há 59 min"],[3600000,"há 1 h"],[86399999,"há 23 h"],[86400000,"há 1 dia"],[172800000,"há 2 dias"],[-60000,"agora"]])("tempo relativo em %sms",(ms,texto)=>expect(haQuanto(new Date(agora.getTime()-(ms as number)).toISOString(),agora)).toBe(texto));
it("datas inválidas não fabricam idade",()=>{expect(haQuanto("inválido",agora)).toBe("");expect(haQuanto(agora.toISOString(),new Date(NaN))).toBe("");});
