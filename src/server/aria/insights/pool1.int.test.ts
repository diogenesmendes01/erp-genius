import { PrismaClient } from "@prisma/client";
import { beforeEach,afterAll,expect,it,vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { cenarioInsight377,respostaInsight377 } from "@/test/inbox-insights";
import { prepararNovoInsight } from "./claim";
import { iniciarInsight } from "./inicio";
import { finalizarInsight } from "./finalizacao";
import { lerInsightAutorizado } from "./leitura";
import { reconciliarInsightInconclusivo,descartarInsightIncerto } from "./operacoes";

beforeEach(()=>truncarBanco());afterAll(()=>prisma.$disconnect());
async function comPool1(rodar:(db:PrismaClient,c:Awaited<ReturnType<typeof cenarioInsight377>>)=>Promise<void>){
  const c=await cenarioInsight377(),url=new URL(process.env.DATABASE_URL!);url.searchParams.set("connection_limit","1");url.searchParams.set("pool_timeout","3");
  const db=new PrismaClient({datasources:{db:{url:url.toString()}}});
  // Fronteira de instrumentação: só proíbe abrir TX global; todas queries reais usam db/tx.
  const global=vi.spyOn(prisma,"$transaction").mockRejectedValue(new Error("Cliente global proibido377 dentro do recorte pool1"));
  try{await rodar(db,c);}finally{global.mockRestore();await db.$disconnect();}
}
it("claim/start/finalizar/GET reais cabem em pool1 sem TX global aninhada",async()=>{
  await comPool1(async(db,c)=>{
    const g=await prepararNovoInsight(c.dono.id,{atendimentoId:c.a.id,chaveTentativa:"377-pool1-000001"},{db,disponivel:true});
    const s=await iniciarInsight(c.dono.id,{atendimentoId:c.a.id,geracaoId:g.geracaoId,versaoEsperada:g.versao,contextoAtualEsperadoHash:g.contextoAtualEsperadoHash},db);expect(s.iniciada).toBe(true);
    expect(await finalizarInsight({atendimentoId:c.a.id,geracaoId:g.geracaoId,envelope:respostaInsight377(),recebidoEm:new Date()},db)).toMatchObject({estado:"PRONTA"});
    expect((await lerInsightAutorizado(c.dono.id,c.a.id,{db,geracaoId:g.geracaoId}))?.observada?.estado).toBe("PRONTA");expect(await db.chamadaIA.count()).toBe(1);
  });
});
it("reconciliação/descarte/replay usam pool1 e não consultam Config/provider",async()=>{
  await comPool1(async(db,c)=>{
    const g=await prepararNovoInsight(c.dono.id,{atendimentoId:c.a.id,chaveTentativa:"377-pool1-000002"},{db,disponivel:true});
    const s=await iniciarInsight(c.dono.id,{atendimentoId:c.a.id,geracaoId:g.geracaoId,versaoEsperada:g.versao,contextoAtualEsperadoHash:g.contextoAtualEsperadoHash},db);await db.configIA.delete({where:{id:"ia"}});
    const r=await lerInsightAutorizado(c.dono.id,c.a.id,{db});if(!r)throw Error("fixture ACL");
    const i={atendimentoId:c.a.id,geracaoId:g.geracaoId,versaoEsperada:s.versao,estadoEsperado:"PROCESSANDO" as const,contextoAtualEsperadoHash:r.contextoAtualEsperadoHash,chaveReconciliacao:"377-pool1-reconcile"};
    const incerta=await reconciliarInsightInconclusivo(c.dono.id,i,db);expect(await reconciliarInsightInconclusivo(c.dono.id,i,db)).toEqual(incerta);
    expect(await descartarInsightIncerto(c.dono.id,{atendimentoId:c.a.id,geracaoId:g.geracaoId,versaoEsperada:incerta.versao,estadoEsperado:"INCERTO",contextoAtualEsperadoHash:r.contextoAtualEsperadoHash,chaveDescarte:"377-pool1-descartar"},db)).toMatchObject({estado:"DESCARTADA"});expect(await db.chamadaIA.count()).toBe(0);
  });
});
