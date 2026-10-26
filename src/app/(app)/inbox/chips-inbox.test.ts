import {expect,it} from "vitest";
import type {FiltrosInbox} from "@/server/inbox/filtros";
import {lerFiltrosInbox} from "@/server/inbox/filtros";
import {chipsDoInbox,chipAtivo,filtrosDoChip,ID_CHIPS} from "./chips-inbox";
const c={todas:900,ia:3,aprovacao:2,handoff:1,humano:5,semResposta:4,naoAtribuidas:7};
it("sete chips têm ordem, rótulo, tom e agregado exatos",()=>{
 expect(ID_CHIPS).toEqual(["todas","ia","aprovacao","handoff","humano","sem-resposta","fila"]);
 expect(chipsDoInbox(c,{}).map(x=>[x.id,x.rotulo,x.tom,x.total])).toEqual([["todas","Todas","neutro",900],["ia","IA atendendo","ia",3],["aprovacao","Aprovação","aprovacao",2],["handoff","Handoff","handoff",1],["humano","Humanos","humano",5],["sem-resposta","Sem resposta","sem-resposta",4],["fila","Não atribuídas","neutro",7]]);
});
it("só limpa dimensões Aria/prazo/fila, preservando eu/ID/naoLidas e demais filtros",()=>{
 const f=Object.freeze({setor:"COMERCIAL",numeroId:"n 1",responsavel:"fila",status:"EM_ATENDIMENTO",busca:"ação & preço",naoLidas:true,aria:"ia",prazoEstourado:true} satisfies FiltrosInbox);
 expect(filtrosDoChip("handoff",f)).toEqual({setor:"COMERCIAL",numeroId:"n 1",status:"EM_ATENDIMENTO",busca:"ação & preço",naoLidas:true,aria:"handoff"});
 for(const responsavel of ["eu","u9"])expect(filtrosDoChip("todas",{...f,responsavel})).toEqual({setor:"COMERCIAL",numeroId:"n 1",status:"EM_ATENDIMENTO",busca:"ação & preço",naoLidas:true,responsavel});
 expect(filtrosDoChip("fila",f)).toMatchObject({responsavel:"fila"});expect(filtrosDoChip("sem-resposta",f)).toMatchObject({prazoEstourado:true});expect(f.aria).toBe("ia");
});
it("ativo prioriza aria, prazo e fila e links fazem roundtrip sem cursor/contagens",()=>{
 expect(chipAtivo({aria:"humano",prazoEstourado:true,responsavel:"fila"})).toBe("humano");expect(chipAtivo({prazoEstourado:true,responsavel:"fila"})).toBe("sem-resposta");expect(chipAtivo({responsavel:"fila"})).toBe("fila");expect(chipAtivo({responsavel:"eu",naoLidas:true})).toBe("todas");
 const f: FiltrosInbox={setor:"COMERCIAL",numeroId:"n 1",responsavel:"eu",naoLidas:true,busca:"ação & preço"};
 for(const chip of chipsDoInbox(c,f)){const url=new URL(chip.href!,"http://fake");expect(url.pathname).toBe("/inbox");expect(lerFiltrosInbox(Object.fromEntries(url.searchParams))).toEqual(filtrosDoChip(chip.id,f));expect(url.searchParams.has("cursor")).toBe(false);expect(url.searchParams.has("contagens")).toBe(false);}
});
