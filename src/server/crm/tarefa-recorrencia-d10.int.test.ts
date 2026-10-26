import {afterAll,beforeEach,expect,it,vi} from "vitest";
import {Prisma} from "@prisma/client";
const {authMock}=vi.hoisted(()=>({authMock:vi.fn()}));
vi.mock("@/server/_shared/sessao",async original=>{const real=await original<typeof import("@/server/_shared/sessao")>();return {...real,exigirSessao:async()=>{const s=await authMock(),u=await real.carregarUsuarioFresco(s.user.id);if(!u)throw new real.ErroAutenticacao();return u;}};});
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {prisma} from "@/lib/prisma";
import {truncarBanco,configurarFusoDaEscola} from "@/test/integracao";
import {cenarioPerda328} from "@/test/inbox-perda";
import {dadosModalTarefaNoInbox,criarTarefaNoInbox,concluirTarefaNoInbox,reabrirTarefaNoInbox} from "@/server/inbox/acoes-painel";
import {materializarRecorrenciaTarefa} from "./tarefa-recorrencia-materializacao";
beforeEach(truncarBanco);afterAll(()=>prisma.$disconnect());
async function cenario(){
 const c=await cenarioPerda328();await configurarFusoDaEscola("UTC");authMock.mockResolvedValue({user:{id:c.dono.id}});
 const d=await dadosModalTarefaNoInbox(c.a.id);if(!d.ok||!d.dado)throw new Error("Canário de contexto recusado");
 const r=await criarTarefaNoInbox(c.a.id,{titulo:"Recorrência D10 fictícia",tipo:"OUTRO",vincularOportunidade:true,jaFeita:false,contextoEsperado:d.dado.contextoEsperado,fusoEscolaEsperado:d.dado.fusoEscola,chaveIdempotencia:"338-recorrencia-nativa-criar",dataCivil:"2030-01-31",hora:"09:00",recorrencia:"MENSAL",notificarUsuarioIds:[c.dono.id]});
 if(!r.ok||!r.dado)throw new Error("Canário de criação recorrente recusado");
 return {...c,tid:r.dado.id};
}
async function concluir(c:Awaited<ReturnType<typeof cenario>>,tid=c.tid){
 const t=await prisma.tarefa.findUniqueOrThrow({where:{id:tid}});
 expect(await concluirTarefaNoInbox(c.a.id,tid,t.versao)).toEqual({ok:true});
 return prisma.intencaoRecorrenciaTarefa.findFirstOrThrow({where:{tarefaId:tid},orderBy:{conclusaoVersao:"desc"}});
}
it("mensal preserva âncora31 em conclusão real, fevereiro e março, com um filho por predecessor",async()=>{
 const c=await cenario(),i=await concluir(c);
 const r=await materializarRecorrenciaTarefa(i.id,{agora:()=>new Date("2030-02-01T00:00:00Z")});
 expect(r.tipo).toBe("CRIADA");if(r.tipo!=="CRIADA")throw new Error("Materialização ausente");
 const f=await prisma.tarefa.findUniqueOrThrow({where:{id:r.tarefaId}});
 expect(f).toMatchObject({status:"ABERTA",dataCivil:"2030-02-28",inicioEm:new Date("2030-02-28T09:00:00Z"),recorrenciaAncoraDataCivil:"2030-01-31",recorrenciaIndice:1,recorrenciaAnteriorId:c.tid,origem:"AUTOMACAO"});
 expect(await prisma.tarefaNotificado.count({where:{tarefaId:f.id}})).toBe(1);
 const segunda=await concluir(c,f.id),marco=await materializarRecorrenciaTarefa(segunda.id,{agora:()=>new Date("2030-03-01T00:00:00Z")});
 expect(marco.tipo).toBe("CRIADA");if(marco.tipo!=="CRIADA")throw new Error("Março ausente");
 expect(await prisma.tarefa.findUniqueOrThrow({where:{id:marco.tarefaId}})).toMatchObject({dataCivil:"2030-03-31",recorrenciaIndice:2,recorrenciaAncoraDataCivil:"2030-01-31"});
 expect(await prisma.tarefa.count({where:{recorrenciaAnteriorId:c.tid}})).toBe(1);
 expect(await prisma.evento.count({where:{tipo:"RecorrenciaTarefaMaterializada"}})).toBe(2);
});
it("cron atrasado pula vencidas, preserva corte original e replay confirmado não consulta relógio",async()=>{
 const c=await cenario(),i=await concluir(c),original=i.corteEm.toISOString(),agora=vi.fn(()=>new Date("2030-04-15T12:00:00Z"));
 const r=await materializarRecorrenciaTarefa(i.id,{agora});expect(agora).toHaveBeenCalledTimes(1);
 expect(r.tipo).toBe("CRIADA");if(r.tipo!=="CRIADA")throw new Error("Filho ausente");
 expect(await prisma.tarefa.findUniqueOrThrow({where:{id:r.tarefaId}})).toMatchObject({dataCivil:"2030-04-30",recorrenciaIndice:3});
 expect((await prisma.intencaoRecorrenciaTarefa.findUniqueOrThrow({where:{id:i.id}})).corteEm.toISOString()).toBe(original);
 const evento=await prisma.evento.findFirstOrThrow({where:{tipo:"RecorrenciaTarefaMaterializada",agregadoId:c.tid}});
 expect(evento.payload).toMatchObject({corteOriginal:original,agoraTentativa:"2030-04-15T12:00:00.000Z",corteEfetivo:"2030-04-15T12:00:00.000Z",indice:3});
 const semClock=vi.fn(()=>{throw new Error("Replay consultou relógio");});
 expect(await materializarRecorrenciaTarefa(i.id,{agora:semClock})).toEqual({tipo:"REPLAY",tarefaId:r.tarefaId});expect(semClock).not.toHaveBeenCalled();
 expect(await prisma.evento.count({where:{tipo:"RecorrenciaTarefaMaterializada",agregadoId:c.tid}})).toBe(1);
});
it("reabertura real cancela intenção pendente sem criar filho nem apagar histórico",async()=>{
 const c=await cenario(),i=await concluir(c),t=await prisma.tarefa.findUniqueOrThrow({where:{id:c.tid}});
 expect(await reabrirTarefaNoInbox(c.a.id,c.tid,t.versao)).toEqual({ok:true});
 expect((await prisma.intencaoRecorrenciaTarefa.findUniqueOrThrow({where:{id:i.id}})).estado).toBe("CANCELADA_REABERTURA");
 expect(await materializarRecorrenciaTarefa(i.id,{agora:()=>new Date("2030-02-01T00:00:00Z")})).toEqual({tipo:"IGNORADA"});
 expect(await prisma.tarefa.count({where:{recorrenciaAnteriorId:c.tid}})).toBe(0);
 expect(await prisma.evento.count({where:{tipo:"TarefaConcluida",agregadoId:c.tid}})).toBe(1);
 expect(await prisma.evento.count({where:{tipo:"TarefaReaberta",agregadoId:c.tid}})).toBe(1);
});
it("CHECKsnapshot rejeita ausente/null/string/array/versão errada sem classificar infra como domínio",async()=>{
 const c=await cenario();
 for(const snapshot of [{},null,"texto",[],{versao:null},{versao:"1"},{versao:2}]){
  await expect(prisma.$executeRaw`INSERT INTO "IntencaoRecorrenciaTarefa" (id,"tarefaId","conclusaoVersao","corteEm",snapshot,"atualizadaEm") VALUES (${`338-check-${JSON.stringify(snapshot)}`},${c.tid},1,${new Date("2030-01-01T00:00:00Z")},${JSON.stringify(snapshot)}::jsonb,CURRENT_TIMESTAMP)`).rejects.toMatchObject({code:"P2010",meta:{code:"23514"}});
 }
 expect(await prisma.intencaoRecorrenciaTarefa.count()).toBe(0);
 await prisma.intencaoRecorrenciaTarefa.create({data:{tarefaId:c.tid,conclusaoVersao:1,corteEm:new Date("2030-01-01T00:00:00Z"),snapshot:{versao:1} as Prisma.InputJsonValue,atualizadaEm:new Date()}});
 expect(await prisma.intencaoRecorrenciaTarefa.count()).toBe(1);
});