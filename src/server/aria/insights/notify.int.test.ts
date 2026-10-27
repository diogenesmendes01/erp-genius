import { executarAtualizacaoInsight } from "./controlador";
import { beforeEach,afterAll,expect,it } from "vitest";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { cenarioInsight377,respostaInsight377 } from "@/test/inbox-insights";
import { conexao377,pausa377 } from "@/test/inbox-insights-observacao";
import { CANAL_INBOX } from "@/server/inbox/barramento";
import { prepararNovoInsight } from "./claim";
import { iniciarInsight } from "./inicio";
import { finalizarInsight } from "./finalizacao";
import { lerInsightAutorizado } from "./leitura";
import { reconciliarInsightInconclusivo,descartarInsightIncerto } from "./operacoes";
import type { BancoInsight } from "./persistencia";

beforeEach(()=>truncarBanco());afterAll(()=>prisma.$disconnect());
async function preparar(){const c=await cenarioInsight377(),g=await prepararNovoInsight(c.dono.id,{atendimentoId:c.a.id,chaveTentativa:"377-notify-000001"},{disponivel:true});return {c,g};}
async function ouvir(atendimentoId:string){
  const listener=await conexao377(),avisos:Record<string,unknown>[]=[];
  listener.on("notification",n=>{if(n.channel===CANAL_INBOX&&n.payload){const v=JSON.parse(n.payload);if(v.atendimentoId===atendimentoId)avisos.push(v);}});
  await listener.query('LISTEN inbox_eventos');
  return {avisos,listener,async sincronizar(){await listener.query('SELECT 1');await pausa377(50);}};
}
it("finalização NOTIFY real commit1/replay0/rollback0, sem spy do barramento",async()=>{
  const {c,g}=await preparar();await iniciarInsight(c.dono.id,{atendimentoId:c.a.id,geracaoId:g.geracaoId,versaoEsperada:g.versao,contextoAtualEsperadoHash:g.contextoAtualEsperadoHash});
  const o=await ouvir(c.a.id),i={atendimentoId:c.a.id,geracaoId:g.geracaoId,envelope:respostaInsight377(),recebidoEm:new Date()};
  const rollbackDb={ $transaction:(f:(tx:Prisma.TransactionClient)=>Promise<unknown>)=>prisma.$transaction(async tx=>{await f(tx);throw new Error("Rollback real após callback377");}) } as unknown as BancoInsight;
  try{
    await expect(finalizarInsight(i,rollbackDb)).rejects.toThrow("Rollback real após callback377");await o.sincronizar();expect(o.avisos).toHaveLength(0);expect(await prisma.chamadaIA.count()).toBe(0);
    const r=await finalizarInsight(i);await o.sincronizar();expect(o.avisos).toHaveLength(1);expect(o.avisos[0]).toMatchObject({atendimentoId:c.a.id,conversaId:c.conversa.id});expect(Object.keys(o.avisos[0]).some(k=>/texto|analise|pessoa|lead|autor|chave/i.test(k))).toBe(false);
    expect(await finalizarInsight(i)).toEqual(r);await o.sincronizar();expect(o.avisos).toHaveLength(1);expect(await prisma.chamadaIA.count()).toBe(1);
  }finally{await o.listener.end();}
});
it("reconciliar/descarte cada commit avisa1 e cada replay0 em LISTEN real",async()=>{
  const {c,g}=await preparar(),s=await iniciarInsight(c.dono.id,{atendimentoId:c.a.id,geracaoId:g.geracaoId,versaoEsperada:g.versao,contextoAtualEsperadoHash:g.contextoAtualEsperadoHash}),r=await lerInsightAutorizado(c.dono.id,c.a.id);if(!r)throw Error("fixture ACL");
  const o=await ouvir(c.a.id),i={atendimentoId:c.a.id,geracaoId:g.geracaoId,versaoEsperada:s.versao,estadoEsperado:"PROCESSANDO" as const,contextoAtualEsperadoHash:r.contextoAtualEsperadoHash,chaveReconciliacao:"377-notify-reconcile"};
  try{
    const incerta=await reconciliarInsightInconclusivo(c.dono.id,i);await o.sincronizar();expect(o.avisos).toHaveLength(1);expect(await reconciliarInsightInconclusivo(c.dono.id,i)).toEqual(incerta);await o.sincronizar();expect(o.avisos).toHaveLength(1);
    const d={atendimentoId:c.a.id,geracaoId:g.geracaoId,versaoEsperada:incerta.versao,estadoEsperado:"INCERTO" as const,contextoAtualEsperadoHash:r.contextoAtualEsperadoHash,chaveDescarte:"377-notify-descartar"};
    const descartada=await descartarInsightIncerto(c.dono.id,d);await o.sincronizar();expect(o.avisos).toHaveLength(2);expect(await descartarInsightIncerto(c.dono.id,d)).toEqual(descartada);await o.sincronizar();expect(o.avisos).toHaveLength(2);
  }finally{await o.listener.end();}
});

it.each([1,2])("commit real com %s ACKs perdidos repete só persistência e GET resolve PRONTA",async quantos=>{
  const c=await cenarioInsight377();let commits=0,perdidos=0,providerChamadas=0;
  const db={ $transaction:async(f:(tx:Prisma.TransactionClient)=>Promise<unknown>)=>{
    const r=await prisma.$transaction(f);commits++;if(commits>=3&&perdidos<quantos){perdidos++;throw new Error("ACK perdido após COMMIT377");}return r;
  }} as unknown as BancoInsight;
  let o:Awaited<ReturnType<typeof ouvir>>|undefined;
  try{
    const r=await executarAtualizacaoInsight(c.dono.id,{tipo:"NOVO",atendimentoId:c.a.id,chaveTentativa:"377-acklost-real-0001"},{db,servicos:{disponivel:()=>true,async executar(){providerChamadas++;o=await ouvir(c.a.id);return respostaInsight377();}}});
    expect(providerChamadas).toBe(1);expect(perdidos).toBe(quantos);expect(await prisma.chamadaIA.count()).toBe(1);expect(await prisma.evento.count({where:{tipo:"InsightInboxFinalizado"}})).toBe(1);
    if(quantos===1)expect(r).toMatchObject({estado:"PRONTA",statusPersistencia:"CONFIRMADA"});
    else{expect(r).toMatchObject({statusPersistencia:"NAO_CONFIRMADA",resultadoIncerto:true,estadoConhecidoAntesFinalizacao:"PROCESSANDO"});expect(r).not.toHaveProperty("estado");expect(r).not.toHaveProperty("versao");}
    const leitura=await lerInsightAutorizado(c.dono.id,c.a.id,{geracaoId:r.geracaoId});expect(leitura?.observada?.estado).toBe("PRONTA");expect(leitura?.painel?.ultima?.analise.textoSugerido).toBe("Texto fictício persistido377");
    const g=await prisma.geracaoInsightInbox.findUniqueOrThrow({where:{id:r.geracaoId}}),uso=await prisma.chamadaIA.findFirstOrThrow();expect(uso.criadoEm).toEqual(g.finalizadoEm);
    if(!o)throw Error("LISTEN não criado pelo fake377");await o.sincronizar();expect(o.avisos).toHaveLength(1);
  }finally{if(o)await o.listener.end();}
});
