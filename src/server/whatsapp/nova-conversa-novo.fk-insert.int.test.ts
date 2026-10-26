import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import { Papel, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { ErroAutenticacao, ErroRegra } from "@/server/_shared/sessao";
import { criarRamoNovoConversaTx, type EntradaRamoNovoConversa } from "./nova-conversa-novo";
const gate=()=>{let liberar!:()=>void;const promessa=new Promise<void>(r=>{liberar=r;});return{promessa,liberar};};
let usuarioId:string,numeroId:string;
beforeAll(async()=>{await truncarBanco();usuarioId=(await criarUsuario([Papel.VENDEDOR],"Vendedor fictício FK")).id;numeroId=(await prisma.numeroWhatsApp.create({data:{telefoneE164:"+50689996666",rotulo:"Linha fictícia FK",driver:"MOTOR",sessao:"DESCONECTADO",finalidade:"VENDAS",ativo:true,donoId:usuarioId}})).id;});
beforeEach(async()=>{await prisma.usuario.update({where:{id:usuarioId},data:{ativo:true}});await prisma.numeroWhatsApp.update({where:{id:numeroId},data:{ativo:true}});});
it.each(["usuarioRevogado","numeroRevogado","numeroVigente"] as const)("FK imediata espera no INSERT %s; SET posterior só em sucesso",async(modo)=>{
 const i=["usuarioRevogado","numeroRevogado","numeroVigente"].indexOf(modo),e:EntradaRamoNovoConversa={autorId:usuarioId,ownerId:usuarioId,numeroId,telefoneE164:`+5068777666${i}`,chaveIdempotencia:`native372-fk-insert-${i}`};
 const pronto=gate(),liberar=gate(),inicio=gate();let pidHolder=0,pidCore=0,fase="inicio";const ordem:string[]=[];
 const antes={pessoas:await prisma.pessoa.count(),contatos:await prisma.contatoWhatsApp.count(),leads:await prisma.oportunidade.count(),eventos:await prisma.evento.count(),contador:(await prisma.contador.findUnique({where:{chave:"lead"}}))?.valor??null};
 const holder=prisma.$transaction(async tx=>{const [p]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid()::int AS pid`;pidHolder=p.pid;if(modo==="usuarioRevogado")await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${usuarioId} FOR UPDATE`;else await tx.$queryRaw`SELECT id FROM "NumeroWhatsApp" WHERE id=${numeroId} FOR UPDATE`;pronto.liberar();await liberar.promessa;if(modo==="usuarioRevogado")await tx.usuario.update({where:{id:usuarioId},data:{ativo:false}});else if(modo==="numeroRevogado")await tx.numeroWhatsApp.update({where:{id:numeroId},data:{ativo:false}});},{timeout:30000}).then(()=>({erro:null}),erro=>({erro}));
 let core:Promise<{dado:Awaited<ReturnType<typeof criarRamoNovoConversaTx>>|null;erro:unknown}>|undefined,erroFixture:unknown;
 try{
  expect(await Promise.race([pronto.promessa.then(()=>"LOCK"),holder.then(()=>"TERMINOU")])).toBe("LOCK");
  core=prisma.$transaction(async tx=>{
   const [p]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid()::int AS pid`;pidCore=p.pid;inicio.liberar();
   const observado=new Proxy(tx,{get(alvo,p,receptor){const v=Reflect.get(alvo,p,receptor);if(typeof v==="function")return async(...args:unknown[])=>{const texto=Array.isArray(args[0])?args[0].join(""):"";if(p==="$executeRaw"&&texto.trim()==="SET CONSTRAINTS ALL IMMEDIATE"){ordem.push("SET.before");const r=await Reflect.apply(v,alvo,args);ordem.push("SET.after");return r;}return Reflect.apply(v,alvo,args);};if(v&&typeof v==="object")return new Proxy(v,{get(m,a){const fn=Reflect.get(m,a);if(typeof fn!=="function")return fn;return(...args:unknown[])=>{fase=`${String(p)}.${String(a)}`;ordem.push(fase);return Reflect.apply(fn,m,args);};}});return v;}}) as Prisma.TransactionClient;
   return criarRamoNovoConversaTx(observado,e);
  },{timeout:30000}).then(dado=>({dado,erro:null}),erro=>({dado:null,erro}));
  expect(await Promise.race([inicio.promessa.then(()=>"CORE"),core.then(()=>"TERMINOU")])).toBe("CORE");
  await prisma.$transaction(async obs=>{
   const [p]=await obs.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid()::int AS pid`;expect(new Set([p.pid,pidHolder,pidCore]).size).toBe(3);
   await vi.waitFor(async()=>{
    expect(fase).toBe(modo==="usuarioRevogado"?"evento.create":"conversaWhatsApp.create");
    const prefixo=modo==="usuarioRevogado"?'INSERT INTO "public"."Evento"%':'INSERT INTO "public"."ConversaWhatsApp"%';
    const [r]=await obs.$queryRaw<{espera:boolean}[]>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity a WHERE a.pid=${pidCore}::int AND a.datname=current_database() AND a.state='active' AND a.wait_event_type='Lock' AND ${pidHolder}::int=ANY(pg_blocking_pids(a.pid)) AND a.query LIKE ${prefixo}) AS espera`;expect(r.espera).toBe(true);expect(ordem).not.toContain("SET.before");
   },{timeout:5000,interval:20});
  },{timeout:10000});
 }catch(erro){erroFixture=erro;}finally{liberar.liberar();}
 const h=await holder,r=core?await core:null;if(erroFixture)throw erroFixture;expect(h.erro).toBeNull();expect(r).not.toBeNull();
 if(modo==="numeroVigente"){
  expect(r!.erro).toBeNull();expect(r!.dado).not.toBeNull();expect(ordem.filter(v=>v==="SET.after")).toHaveLength(1);expect(ordem.lastIndexOf("usuario.findUnique")).toBeGreaterThan(ordem.indexOf("SET.after"));
  expect(await prisma.oportunidade.count()).toBe(antes.leads+1);expect(await prisma.pessoa.count()).toBe(antes.pessoas+1);expect(await prisma.evento.count()).toBe(antes.eventos+5);
 }else{
  expect(r!.erro).toBeInstanceOf(modo==="usuarioRevogado"?ErroAutenticacao:ErroRegra);expect(r!.dado).toBeNull();expect(await prisma.pessoa.count()).toBe(antes.pessoas);expect(await prisma.contatoWhatsApp.count()).toBe(antes.contatos);expect(await prisma.oportunidade.count()).toBe(antes.leads);expect(await prisma.evento.count()).toBe(antes.eventos);expect((await prisma.contador.findUnique({where:{chave:"lead"}}))?.valor??null).toBe(antes.contador);
 }
 expect(await prisma.intencaoMensagem.count()).toBe(0);expect(await prisma.mensagemWhatsApp.count()).toBe(0);
});