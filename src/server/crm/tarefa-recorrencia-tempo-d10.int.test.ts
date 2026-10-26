import {afterAll,beforeEach,expect,it,vi} from "vitest";
import {writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {randomUUID} from "node:crypto";
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {prisma} from "@/lib/prisma";
import {truncarBanco} from "@/test/integracao";
import {cenarioPerda328} from "@/test/inbox-perda";
import {concluirTarefaTx} from "./tarefas-transicoes";
import {exigirCapacidadeCrm} from "./permissoes";
beforeEach(truncarBanco);afterAll(()=>prisma.$disconnect());
it.each(["UTC","America/Sao_Paulo"] as const)("oráculo503 produtor corte/instante/audit preserva epochJS/PG em %s",async zona=>{
 const toleranciaMs=250,arquivo=join(tmpdir(),`inbox-338-tempo-r30-${zona.replaceAll("/","_")}-${randomUUID()}.json`);
 const registro:Record<string,unknown>={caso:"D10_TEMPORAL_ORACLE",zonaEsperada:zona,toleranciaMs,fase:"PREPARANDO"};
 const preservar=()=>writeFileSync(arquivo,JSON.stringify(registro,null,2),"utf8");
 try{
  const c=await cenarioPerda328();
  const tarefa=await prisma.tarefa.create({data:{titulo:"Oráculo temporal fictício338",tipo:"OUTRO",setor:"COMERCIAL",responsavelId:c.dono.id,criadorId:c.dono.id,atendimentoId:c.a.id,fusoOrigem:"UTC",dataCivil:"2030-01-31",inicioEm:new Date("2030-01-31T09:00:00Z"),recorrencia:"MENSAL",recorrenciaAncoraDataCivil:"2030-01-31",recorrenciaAncoraHora:"09:00",recorrenciaAncoraFuso:"UTC",recorrenciaPoliticaVersao:1}});
  const jsTxAntes=Date.now();
  const evidencia=await prisma.$transaction(async tx=>{
   // Lista literal fechada: SET LOCAL só afeta esta TX de diagnóstico.
   if(zona==="UTC")await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
   else await tx.$executeRaw`SET LOCAL TIME ZONE 'America/Sao_Paulo'`;
   const jsClock1Antes=Date.now();
   const [antes]=await tx.$queryRaw<{agora:Date;zona:string}[]>`SELECT clock_timestamp() AS agora,current_setting('TimeZone') AS zona`;
   const jsClock1Depois=Date.now();
   const autor=await tx.usuario.findUniqueOrThrow({where:{id:c.dono.id}});expect(autor.ativo).toBe(true);exigirCapacidadeCrm(autor,"tarefas.ver");
   const atual=await tx.tarefa.findUniqueOrThrow({where:{id:tarefa.id}});expect(atual.responsavelId).toBe(autor.id);
   const jsProdutorAntes=Date.now();
   await concluirTarefaTx({tx,autor,tarefa:atual,versao:atual.versao,filtro:{responsavelId:autor.id}},null);
   const jsProdutorDepois=Date.now();
   const pai=await tx.tarefa.findUniqueOrThrow({where:{id:tarefa.id}}),intencao=await tx.intencaoRecorrenciaTarefa.findUniqueOrThrow({where:{tarefaId_conclusaoVersao:{tarefaId:tarefa.id,conclusaoVersao:atual.versao+1}}});
   const jsClock2Antes=Date.now();
   const [depois]=await tx.$queryRaw<{agora:Date;zona:string;corteEpoch:number;criadaEpoch:number}[]>`SELECT clock_timestamp() AS agora,current_setting('TimeZone') AS zona,(extract(epoch FROM ("corteEm" AT TIME ZONE 'UTC'))*1000)::float8 AS "corteEpoch",(extract(epoch FROM ("criadaEm" AT TIME ZONE 'UTC'))*1000)::float8 AS "criadaEpoch" FROM "IntencaoRecorrenciaTarefa" WHERE id=${intencao.id}`;
   const jsClock2Depois=Date.now();
   return {zona1:antes.zona,zona2:depois.zona,pgAntes:antes.agora.getTime(),pgDepois:depois.agora.getTime(),jsClock1Antes,jsClock1Depois,jsClock2Antes,jsClock2Depois,jsProdutorAntes,jsProdutorDepois,corteEm:intencao.corteEm.getTime(),concluidaEm:pai.concluidaEm!.getTime(),criadaEm:intencao.criadaEm.getTime(),corteEpoch:depois.corteEpoch,criadaEpoch:depois.criadaEpoch,inicioEm:pai.inicioEm!.toISOString()};
  });
  const jsTxDepois=Date.now();
  registro.fase="MEDIDO_ANTES_ASSERTS";registro.medidas={...evidencia,jsTxAntes,jsTxDepois,deltaPG1JSAntes:evidencia.pgAntes-evidencia.jsClock1Antes,deltaPG1JSDepois:evidencia.pgAntes-evidencia.jsClock1Depois,deltaPG2JSAntes:evidencia.pgDepois-evidencia.jsClock2Antes,deltaPG2JSDepois:evidencia.pgDepois-evidencia.jsClock2Depois,deltaAuditPG:evidencia.criadaEm-evidencia.pgAntes,deltaCortePG:evidencia.corteEm-evidencia.pgAntes,deltaAuditJS:evidencia.criadaEm-jsTxAntes,deltaCorteJS:evidencia.corteEm-evidencia.jsProdutorAntes};preservar();
  expect(evidencia.zona1).toBe(zona);expect(evidencia.zona2).toBe(zona);
  // Cada epochPG deve cair no próprio intervalo JS que cercou sua consulta.
  for(const [pg,antes,depois] of [[evidencia.pgAntes,evidencia.jsClock1Antes,evidencia.jsClock1Depois],[evidencia.pgDepois,evidencia.jsClock2Antes,evidencia.jsClock2Depois]]){expect(pg).toBeGreaterThanOrEqual(antes-toleranciaMs);expect(pg).toBeLessThanOrEqual(depois+toleranciaMs);}
  expect(evidencia.inicioEm).toBe("2030-01-31T09:00:00.000Z");
  expect(evidencia.corteEm).toBe(evidencia.concluidaEm);expect(evidencia.corteEpoch).toBe(evidencia.corteEm);expect(evidencia.criadaEpoch).toBe(evidencia.criadaEm);
  expect(evidencia.corteEm).toBeGreaterThanOrEqual(evidencia.jsProdutorAntes-toleranciaMs);expect(evidencia.corteEm).toBeLessThanOrEqual(evidencia.jsProdutorDepois+toleranciaMs);
  expect(evidencia.criadaEm).toBeGreaterThanOrEqual(jsTxAntes-toleranciaMs);expect(evidencia.criadaEm).toBeLessThanOrEqual(jsTxDepois+toleranciaMs);
  expect(await prisma.intencaoRecorrenciaTarefa.count({where:{tarefaId:tarefa.id}})).toBe(1);
  registro.fase="ASSERTS_PASSARAM";
 }catch(erro){registro.fase="FALHOU";const e=erro as {name?:unknown;code?:unknown;meta?:{code?:unknown}};registro.erro={nome:typeof e?.name==="string"?e.name:null,codigo:typeof e?.code==="string"?e.code:null,sqlState:typeof e?.meta?.code==="string"?e.meta.code:null};throw erro;}
 finally{preservar();}
});