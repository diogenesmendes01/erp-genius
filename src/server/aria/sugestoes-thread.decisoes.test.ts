import { expect,it,vi } from "vitest";
import { Papel } from "@prisma/client";
import type { Db } from "../whatsapp/escopo";
import { cartoesDaThread } from "./sugestoes-thread";
const u={id:"v",nome:"Vendedor",papeis:[Papel.VENDEDOR]};
const a={id:"thread",leadId:"lead",responsavelId:"v",finalidade:"COMERCIAL"};
const linha=(id:string,status="SUGERIDA",oportunidadeId:string|null="lead",pessoaId="p")=>({id,turnoId:"turno",acao:"TAG",status,criadoEm:new Date("2026-10-25T12:00Z"),expiraEm:null,justificativa:null,payload:{pessoaId,tagId:"tag",nome:"Interesse"},oportunidadeId,decididaPorId:null,decididaEm:status==="SUGERIDA"?null:new Date("2026-10-25T12:01Z"),reversivel:true,desfeitaPorId:null,desfeitaEm:null});
function banco(linhas:ReturnType<typeof linha>[]){const b={oportunidade:{findMany:vi.fn().mockResolvedValue([{id:"lead",pessoaId:"p"},{id:"outro",pessoaId:"p2"}])},acaoAgenteIA:{findMany:vi.fn().mockResolvedValue(linhas)},usuario:{findMany:vi.fn().mockResolvedValue([])}};return {b,db:b as unknown as Db};}
it("responsável recebe vinte cartões com capacidade por ação sem N+1",async()=>{
 const {b,db}=banco(Array.from({length:21},(_,i)=>linha("s"+i)));
 const cards=await cartoesDaThread(db,u,a,new Date("2026-10-25T13:00Z"));
 expect(cards).toHaveLength(20);expect(cards.every(c=>c.podeDecidir&&!c.podeDesfazer)).toBe(true);expect(b.oportunidade.findMany).toHaveBeenCalledTimes(1);
});
it("alvo divergente e payload de outra pessoa ficam fora, fallback atual válido fica",async()=>{
 const {db}=banco([linha("alvo","SUGERIDA","outro","p2"),linha("pessoa","SUGERIDA","lead","p2"),linha("fallback","SUGERIDA",null)]);
 expect((await cartoesDaThread(db,u,a,new Date())).map(c=>c.id)).toEqual(["fallback"]);
});
it("aprovação/executada reversível oferece desfazer, desfeita é histórico sem CTA",async()=>{
 const {db}=banco([linha("aprovada","APROVADA"),linha("executada","EXECUTADA"),linha("desfeita","DESFEITA")]);
 const cards=await cartoesDaThread(db,u,a,new Date());
 expect(cards.map(c=>[c.id,c.podeDecidir,c.podeDesfazer])).toEqual([["aprovada",false,true],["executada",false,true],["desfeita",false,false]]);
});
it("vendedor apenas da carteira sem responsabilidade não recebe cartões decisórios",async()=>{
 const {db}=banco([linha("s")]);expect(await cartoesDaThread(db,u,{...a,responsavelId:"outro"},new Date())).toEqual([]);
});
