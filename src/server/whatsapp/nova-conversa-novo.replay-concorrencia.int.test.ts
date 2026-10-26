import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { ErroRegra } from "@/server/_shared/sessao";
import { criarRamoNovoConversaTx, type EntradaRamoNovoConversa } from "./nova-conversa-novo";
const gate=()=>{let liberar!:()=>void;const promessa=new Promise<void>(r=>{liberar=r;});return{promessa,liberar};};
let usuarioId:string,numeroId:string;
beforeAll(async()=>{await truncarBanco();usuarioId=(await criarUsuario([Papel.VENDEDOR],"Vendedor fictício replay")).id;numeroId=(await prisma.numeroWhatsApp.create({data:{telefoneE164:"+50689993333",rotulo:"Linha fictícia replay",driver:"MOTOR",sessao:"DESCONECTADO",finalidade:"VENDAS",ativo:true,donoId:usuarioId}})).id;});
beforeEach(async()=>{await prisma.numeroWhatsApp.update({where:{id:numeroId},data:{ativo:true}});});
it.each(["igual","divergente","linhaRevogada"] as const)("replay concorrente %s serializa no idem e revalida sem repetir efeitos",async(modo)=>{
 const i=["igual","divergente","linhaRevogada"].indexOf(modo),entrada:EntradaRamoNovoConversa={autorId:usuarioId,ownerId:usuarioId,numeroId,telefoneE164:`+5068777333${i}`,chaveIdempotencia:`native372-replay-concorrente-${i}`};
 const pronto=gate(),soltar=gate(),segundaInicio=gate(),aposIdem=gate(),liberarFresh=gate();let pid1=0,pid2=0,fase2="inicio";
 const antes={leads:await prisma.oportunidade.count(),pessoas:await prisma.pessoa.count(),eventos:await prisma.evento.count()};
 const primeira=prisma.$transaction(async tx=>{
  const [pid]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid()::int AS pid`;pid1=pid.pid;
  const observado=new Proxy(tx,{get(alvo,p,receptor){const v=Reflect.get(alvo,p,receptor);if(p!=="contatoWhatsApp")return typeof v==="function"?v.bind(alvo):v;return new Proxy(v,{get(m,a){const fn=Reflect.get(m,a);if(a!=="create")return typeof fn==="function"?fn.bind(m):fn;return async(...args:unknown[])=>{const dado=await Reflect.apply(fn,m,args);pronto.liberar();await soltar.promessa;return dado;};}});}}) as Prisma.TransactionClient;
  return criarRamoNovoConversaTx(observado,entrada);
 },{timeout:30000}).then(dado=>({dado,erro:null}),erro=>({dado:null,erro}));
 let segunda:Promise<Awaited<typeof primeira>>|undefined,erroFixture:unknown;
 try{
  expect(await Promise.race([pronto.promessa.then(()=>"INSERT"),primeira.then(()=>"TERMINOU")])).toBe("INSERT");
  segunda=prisma.$transaction(async tx=>{
   const [pid]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid()::int AS pid`;pid2=pid.pid;segundaInicio.liberar();let primeiroExecute=true;
   const observado=new Proxy(tx,{get(alvo,p,receptor){const v=Reflect.get(alvo,p,receptor);if(p!=="$executeRaw"||typeof v!=="function")return typeof v==="function"?v.bind(alvo):v;return async(...args:unknown[])=>{if(!primeiroExecute)return Reflect.apply(v,alvo,args);primeiroExecute=false;fase2="idem.lock";const r=await Reflect.apply(v,alvo,args);fase2="idem.obtido";aposIdem.liberar();if(modo==="linhaRevogada")await liberarFresh.promessa;return r;};}}) as Prisma.TransactionClient;
   return criarRamoNovoConversaTx(observado,{...entrada,...(modo==="divergente"?{nome:"Outro nome manual fictício"}:{})});
  },{timeout:30000}).then(dado=>({dado,erro:null}),erro=>({dado:null,erro}));
  expect(await Promise.race([segundaInicio.promessa.then(()=>"INICIO"),segunda.then(()=>"TERMINOU")])).toBe("INICIO");
  await prisma.$transaction(async obs=>{
   const [pid]=await obs.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid()::int AS pid`;expect(new Set([pid1,pid2,pid.pid]).size).toBe(3);
   await vi.waitFor(async()=>{expect(fase2).toBe("idem.lock");const [r]=await obs.$queryRaw<{espera:boolean}[]>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity a WHERE a.pid=${pid2}::int AND a.datname=current_database() AND a.state='active' AND a.wait_event_type='Lock' AND ${pid1}::int=ANY(pg_blocking_pids(a.pid)) AND a.query LIKE 'SELECT pg_advisory_xact_lock(hashtextextended(%') AS espera`;expect(r.espera).toBe(true);},{timeout:5000,interval:20});
  },{timeout:10000});
  soltar.liberar();const r1=await primeira;expect(r1.erro).toBeNull();
  if(modo==="linhaRevogada"){expect(await Promise.race([aposIdem.promessa.then(()=>"IDEM"),segunda.then(()=>"TERMINOU")])).toBe("IDEM");await prisma.numeroWhatsApp.update({where:{id:numeroId},data:{ativo:false}});}
 }catch(erro){erroFixture=erro;}finally{soltar.liberar();liberarFresh.liberar();}
 const r1=await primeira,r2=segunda?await segunda:null;if(erroFixture)throw erroFixture;expect(r1.erro).toBeNull();expect(r2).not.toBeNull();
 if(modo==="igual"){expect(r2!.erro).toBeNull();expect(r2!.dado).toEqual(r1.dado);}else{expect(r2!.erro).toBeInstanceOf(ErroRegra);expect(r2!.dado).toBeNull();}
 expect(await prisma.oportunidade.count()).toBe(antes.leads+1);expect(await prisma.pessoa.count()).toBe(antes.pessoas+1);expect(await prisma.evento.count()).toBe(antes.eventos+5);expect(await prisma.intencaoMensagem.count()).toBe(0);expect(await prisma.mensagemWhatsApp.count()).toBe(0);
});