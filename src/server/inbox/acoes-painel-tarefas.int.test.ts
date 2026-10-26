import {Client} from "pg";
import {CANAL_INBOX} from "./barramento";
import { afterAll, beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/server/_shared/sessao", async original => { const real = await original<typeof import("@/server/_shared/sessao")>(); return { ...real, exigirSessao: async () => { const s = await authMock(); const u = await real.carregarUsuarioFresco(s.user.id); if (!u) throw new real.ErroAutenticacao(); return u; } }; });
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { Papel, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { cenarioPerda328 } from "@/test/inbox-perda";
import * as aviso from "./aviso";
import { concluirTarefaNoInbox, reabrirTarefaNoInbox, reagendarTarefaNoInbox, cancelarTarefaNoInbox } from "./acoes-painel";
beforeEach(async () => { vi.restoreAllMocks(); await truncarBanco(); });
afterAll(() => prisma.$disconnect());
async function cenario() {
 const c = await cenarioPerda328(); authMock.mockResolvedValue({user:{id:c.dono.id}});
 await prisma.configuracaoOperacional.upsert({where:{id:"escola"},create:{id:"escola",fusoInstitucional:"America/Sao_Paulo"},update:{fusoInstitucional:"America/Sao_Paulo"}});
 const t = await prisma.tarefa.create({data:{titulo:"Retorno330",tipo:"LIGACAO",setor:"COMERCIAL",responsavelId:c.dono.id,criadorId:c.dono.id,leadId:c.op.id,fusoOrigem:"America/Costa_Rica",lembreteAntecedenciaMin:30}});
 return {...c,t};
}
it("conclui e reabre tarefa do lead com Evento e aviso na mesma operação",async()=>{
 const c=await cenario(),a=vi.spyOn(aviso,"avisarAtendimento");
 expect(await concluirTarefaNoInbox(c.a.id,c.t.id,1)).toEqual({ok:true});
 expect(await reabrirTarefaNoInbox(c.a.id,c.t.id,2)).toEqual({ok:true});
 expect(await prisma.tarefa.findUniqueOrThrow({where:{id:c.t.id}})).toMatchObject({status:"ABERTA",versao:3,resultado:null});
 expect(await prisma.evento.count({where:{agregadoTipo:"Tarefa",agregadoId:c.t.id}})).toBe(2);expect(a).toHaveBeenCalledTimes(2);
});
it("reagenda no fuso institucional preservando origem, instante e lembrete",async()=>{
 const c=await cenario();
 expect(await reagendarTarefaNoInbox(c.a.id,c.t.id,1,{dataCivil:"2026-10-23",hora:"09:00",fusoEscolaEsperado:"America/Sao_Paulo"})).toEqual({ok:true});
 expect(await prisma.tarefa.findUniqueOrThrow({where:{id:c.t.id}})).toMatchObject({dataCivil:"2026-10-23",inicioEm:new Date("2026-10-23T12:00:00Z"),lembrarEm:new Date("2026-10-23T11:30:00Z"),fusoOrigem:"America/Costa_Rica",versao:2});
 expect(await concluirTarefaNoInbox(c.a.id,c.t.id,1)).toEqual({ok:false,erro:"Esta tarefa foi alterada por outra pessoa. Recarregue."});
});
it("recusa tarefa alheia, mas aceita vínculo direto sem lead",async()=>{
 const c=await cenario();await prisma.tarefa.update({where:{id:c.t.id},data:{leadId:null}});
 expect(await concluirTarefaNoInbox(c.a.id,c.t.id,1)).toEqual({ok:false,erro:"Tarefa não encontrada."});
 await prisma.atendimentoWhatsApp.update({where:{id:c.a.id},data:{leadId:null}});
 await prisma.tarefa.update({where:{id:c.t.id},data:{atendimentoId:c.a.id}});
 expect(await concluirTarefaNoInbox(c.a.id,c.t.id,1)).toEqual({ok:true});
});
it("replay cancelamento mesmo autor/motivo não duplica Evento/aviso",async()=>{
 const c=await cenario(),a=vi.spyOn(aviso,"avisarAtendimento");
 expect(await cancelarTarefaNoInbox(c.a.id,c.t.id,1," Cliente pediu ")).toEqual({ok:true});
 expect(await cancelarTarefaNoInbox(c.a.id,c.t.id,1,"Cliente pediu")).toEqual({ok:true});
 expect(await prisma.evento.count({where:{tipo:"TarefaCancelada",agregadoId:c.t.id}})).toBe(1);expect(a).toHaveBeenCalledOnce();
});
it("dobra DST na origem não perde o instante já resolvido na escola",async()=>{
 const c=await cenario();await prisma.tarefa.update({where:{id:c.t.id},data:{fusoOrigem:"America/New_York"}});
 expect(await reagendarTarefaNoInbox(c.a.id,c.t.id,1,{dataCivil:"2026-11-01",hora:"02:30",fusoEscolaEsperado:"America/Sao_Paulo"})).toEqual({ok:true});
 expect(await prisma.tarefa.findUniqueOrThrow({where:{id:c.t.id}})).toMatchObject({inicioEm:new Date("2026-11-01T05:30:00Z"),dataCivil:"2026-11-01",fusoOrigem:"America/New_York"});
});
it("fuso esperado divergente recusa sem versão/Evento/aviso",async()=>{
 const c=await cenario(),a=vi.spyOn(aviso,"avisarAtendimento");
 expect((await reagendarTarefaNoInbox(c.a.id,c.t.id,1,{dataCivil:"2026-10-23",hora:"09:00",fusoEscolaEsperado:"America/Costa_Rica"})).ok).toBe(false);
 expect(await prisma.evento.count()).toBe(0);expect(a).not.toHaveBeenCalled();expect((await prisma.tarefa.findUniqueOrThrow({where:{id:c.t.id}})).versao).toBe(1);
});
it("duas conclusões SQL reais com mesma versão têm um vencedor",async()=>{
 const c=await cenario();const r=await Promise.all([concluirTarefaNoInbox(c.a.id,c.t.id,1),concluirTarefaNoInbox(c.a.id,c.t.id,1)]);
 expect(r.filter(x=>x.ok)).toHaveLength(1);expect(await prisma.evento.count({where:{tipo:"TarefaConcluida",agregadoTipo:"Tarefa",agregadoId:c.t.id}})).toBe(1);
 expect((await prisma.tarefa.findUniqueOrThrow({where:{id:c.t.id}})).versao).toBe(2);
});
it("dois cancelamentos SQL reais repetidos gravam uma única transição",async()=>{
 const c=await cenario(),a=vi.spyOn(aviso,"avisarAtendimento");expect(await Promise.all([cancelarTarefaNoInbox(c.a.id,c.t.id,1,"Pedido"),cancelarTarefaNoInbox(c.a.id,c.t.id,1,"Pedido")])).toEqual([{ok:true},{ok:true}]);
 expect(await prisma.evento.count({where:{tipo:"TarefaCancelada",agregadoId:c.t.id}})).toBe(1);expect(a).toHaveBeenCalledOnce();
});
it("cancelamento não dá replay a outro autor/motivo nem após perda de ACL",async()=>{
 const c=await cenario();await cancelarTarefaNoInbox(c.a.id,c.t.id,1,"Pedido");
 expect((await cancelarTarefaNoInbox(c.a.id,c.t.id,1,"Outro motivo")).ok).toBe(false);
 const admin=await criarUsuario([Papel.ADMINISTRADOR]);authMock.mockResolvedValue({user:{id:admin.id}});
 expect((await cancelarTarefaNoInbox(c.a.id,c.t.id,1,"Pedido")).ok).toBe(false);
 await prisma.usuario.update({where:{id:c.dono.id},data:{papeis:[Papel.PROFESSOR]}});authMock.mockResolvedValue({user:{id:c.dono.id}});
 expect((await cancelarTarefaNoInbox(c.a.id,c.t.id,1,"Pedido")).ok).toBe(false);
 expect(await prisma.evento.count({where:{tipo:"TarefaCancelada",agregadoId:c.t.id}})).toBe(1);
});
it.each(["troca lead","papel revogado","inativado","fora escopo"])("fresh autorização após espera SQL: %s",async caso=>{
 const c=await cenario(),holder=new PrismaClient();let pronto!:()=>void,liberar!:()=>void;
 const pronta=new Promise<void>(r=>pronto=r),livre=new Promise<void>(r=>liberar=r);
 let trava:Promise<unknown>|undefined,tentativa:ReturnType<typeof concluirTarefaNoInbox>|undefined;
 try{
  trava=holder.$transaction(async tx=>{
   if(caso==="troca lead")await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${c.a.id} FOR UPDATE`;
   else await tx.$queryRaw`SELECT id FROM "Tarefa" WHERE id=${c.t.id} FOR UPDATE`;
   pronto();await livre;
   if(caso==="troca lead")await tx.atendimentoWhatsApp.update({where:{id:c.a.id},data:{leadId:null}});
   else if(caso==="fora escopo")await tx.tarefa.update({where:{id:c.t.id},data:{responsavelId:null,setor:"FINANCEIRO"}});
   else await tx.usuario.update({where:{id:c.dono.id},data:caso==="inativado"?{ativo:false}:{papeis:[Papel.PROFESSOR]}});
  },{timeout:20000});
  await pronta;tentativa=concluirTarefaNoInbox(c.a.id,c.t.id,1);
  await vi.waitFor(async()=>{const rows=await prisma.$queryRaw<{n:bigint}[]>`SELECT count(*) n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FOR UPDATE%'`;expect(Number(rows[0].n)).toBeGreaterThan(0);});
  liberar();await trava;expect((await tentativa).ok).toBe(false);
  expect((await prisma.tarefa.findUniqueOrThrow({where:{id:c.t.id}})).versao).toBe(1);expect(await prisma.evento.count()).toBe(0);
 }finally{liberar?.();await trava?.catch(()=>{});await tentativa?.catch(()=>{});await holder.$disconnect();}
});
it("falha injetada depois do aviso SQL reverte tarefa e Eventos",async()=>{
 const c=await cenario(),real=aviso.avisarAtendimento,log=vi.spyOn(console,"error").mockImplementation(()=>{});
 vi.spyOn(aviso,"avisarAtendimento").mockImplementation(async(...args)=>{await real(...args);throw Error("falha330-aviso");});
 expect((await concluirTarefaNoInbox(c.a.id,c.t.id,1)).ok).toBe(false);
 expect(await prisma.tarefa.findUniqueOrThrow({where:{id:c.t.id}})).toMatchObject({status:"ABERTA",versao:1});expect(await prisma.evento.count()).toBe(0);log.mockRestore();
});
it("ator com tarefas.ver sem funil.mover age com convite e vínculo direto válidos",async()=>{
 const c=await cenario(),ator=await criarUsuario([Papel.SECRETARIA_ACADEMICA]);
 await prisma.participanteAtendimentoWhatsApp.create({data:{atendimentoId:c.a.id,usuarioId:ator.id,concedenteId:c.dono.id,inicio:new Date(Date.now()-10000),fim:new Date(Date.now()+3600000),motivo:"Tarefas330"}});
 await prisma.tarefa.update({where:{id:c.t.id},data:{responsavelId:ator.id,setor:"SECRETARIA",atendimentoId:c.a.id,leadId:null}});
 authMock.mockResolvedValue({user:{id:ator.id}});expect(await concluirTarefaNoInbox(c.a.id,c.t.id,1)).toEqual({ok:true});
});
it.each(["convite revogado","equipe revogada"])("revalida %s após lock real da Tarefa",async caso=>{
 const c=await cenario(),ator=await criarUsuario([caso==="convite revogado"?Papel.SECRETARIA_ACADEMICA:Papel.GERENTE_COMERCIAL]);
 let conviteId:string|null=null;
 if(caso==="convite revogado"){
  const p=await prisma.participanteAtendimentoWhatsApp.create({data:{atendimentoId:c.a.id,usuarioId:ator.id,concedenteId:c.dono.id,inicio:new Date(Date.now()-10000),fim:new Date(Date.now()+3600000),motivo:"Tarefas330"}});conviteId=p.id;
  await prisma.tarefa.update({where:{id:c.t.id},data:{responsavelId:ator.id,setor:"SECRETARIA",atendimentoId:c.a.id,leadId:null}});
 }else await prisma.usuario.update({where:{id:c.dono.id},data:{gerenteComercialId:ator.id}});
 authMock.mockResolvedValue({user:{id:ator.id}});
 const holder=new PrismaClient();let pronto!:()=>void,liberar!:()=>void;const pronta=new Promise<void>(r=>pronto=r),livre=new Promise<void>(r=>liberar=r);
 let trava:Promise<unknown>|undefined,tentativa:ReturnType<typeof concluirTarefaNoInbox>|undefined;
 try{trava=holder.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Tarefa" WHERE id=${c.t.id} FOR UPDATE`;pronto();await livre;
  if(conviteId)await tx.participanteAtendimentoWhatsApp.update({where:{id:conviteId},data:{revogadoEm:new Date()}});else await tx.usuario.update({where:{id:c.dono.id},data:{gerenteComercialId:null}});
 },{timeout:20000});await pronta;tentativa=concluirTarefaNoInbox(c.a.id,c.t.id,1);
 await vi.waitFor(async()=>{const rows=await prisma.$queryRaw<{n:bigint}[]>`SELECT count(*) n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FOR UPDATE%'`;expect(Number(rows[0].n)).toBeGreaterThan(0);});
 liberar();await trava;expect((await tentativa).ok).toBe(false);expect((await prisma.tarefa.findUniqueOrThrow({where:{id:c.t.id}})).versao).toBe(1);expect(await prisma.evento.count()).toBe(0);
 }finally{liberar?.();await trava?.catch(()=>{});await tentativa?.catch(()=>{});await holder.$disconnect();}
});
it("NOTIFY nativo publica um cancelamento, replay não publica e rollback não vaza",async()=>{
 const c=await cenario(),client=new Client({connectionString:process.env.DATABASE_URL}),quadros:Record<string,unknown>[]=[];
 client.on("notification",n=>{if(n.channel===CANAL_INBOX&&n.payload)quadros.push(JSON.parse(n.payload));});await client.connect();await client.query("LISTEN "+CANAL_INBOX);
 try{
  expect(await cancelarTarefaNoInbox(c.a.id,c.t.id,1,"Pedido")).toEqual({ok:true});expect(await cancelarTarefaNoInbox(c.a.id,c.t.id,1,"Pedido")).toEqual({ok:true});
  const t=await prisma.tarefa.create({data:{titulo:"Rollback330",tipo:"OUTRO",setor:"COMERCIAL",responsavelId:c.dono.id,leadId:c.op.id,fusoOrigem:"America/Sao_Paulo"}});
  const real=aviso.avisarAtendimento,spy=vi.spyOn(aviso,"avisarAtendimento").mockImplementation(async(...args)=>{await real(...args);throw Error("aviso330");}),log=vi.spyOn(console,"error").mockImplementation(()=>{});
  expect((await concluirTarefaNoInbox(c.a.id,t.id,1)).ok).toBe(false);spy.mockRestore();log.mockRestore();
  const sent=await prisma.atendimentoWhatsApp.create({data:{conversaId:c.conversa.id,contextoChave:"COMERCIAL::sentinela330",finalidade:"COMERCIAL"}});await aviso.avisarAtendimento(prisma,sent.id);
  await vi.waitFor(()=>expect(quadros.some(q=>q.atendimentoId===sent.id)).toBe(true));
  expect(quadros.filter(q=>q.atendimentoId===c.a.id)).toHaveLength(1);
  expect(await prisma.tarefa.findUniqueOrThrow({where:{id:t.id}})).toMatchObject({status:"ABERTA",versao:1});expect(await prisma.evento.count({where:{agregadoId:t.id}})).toBe(0);
 }finally{await client.end();}
});