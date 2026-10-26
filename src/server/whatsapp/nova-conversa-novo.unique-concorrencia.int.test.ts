import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Prisma } from "@prisma/client";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { ErroRegra } from "@/server/_shared/sessao";
import { criarRamoNovoConversaTx, type EntradaRamoNovoConversa } from "./nova-conversa-novo";
let usuarioId:string,numeroId:string;
const gate=()=>{let liberar!:()=>void;const promessa=new Promise<void>(r=>{liberar=r;});return{promessa,liberar};};
const token=(v:unknown)=>typeof v==="string"&&/^[A-Za-z0-9_$][A-Za-z0-9_$.[\]]{0,100}$/.test(v)?v:null;
function sanitizar(erro:unknown,nivel=0):unknown{if(!erro||typeof erro!=="object"||nivel>2)return null;const r=(k:string)=>Reflect.get(erro,k),m=r("meta");return{name:token(r("name")),code:token(r("code")),meta:m&&typeof m==="object"?{code:token(Reflect.get(m,"code")),modelName:token(Reflect.get(m,"modelName")),target:Array.isArray(Reflect.get(m,"target"))?Reflect.get(m,"target").map(token):token(Reflect.get(m,"target"))}:null,cause:sanitizar(r("cause"),nivel+1)};}
beforeAll(async()=>{await truncarBanco();const u=await criarUsuario([Papel.VENDEDOR],"Vendedor fictício UNIQUE");usuarioId=u.id;numeroId=(await prisma.numeroWhatsApp.create({data:{telefoneE164:"+50689992222",rotulo:"Linha fictícia UNIQUE",driver:"MOTOR",sessao:"DESCONECTADO",finalidade:"VENDAS",ativo:true,donoId:u.id}})).id;});
beforeEach(()=>{vi.restoreAllMocks();});
it.each(["commit","rollback"] as const)("UNIQUE real: primeira %s, sem adoção de tupla ou efeitos parciais",async(modo)=>{
 const i=modo==="commit"?1:2,entrada:EntradaRamoNovoConversa={autorId:usuarioId,ownerId:usuarioId,numeroId,telefoneE164:`+5068777222${i}`,chaveIdempotencia:`native372-unique-primeira-${i}`};
 const criada=gate(),soltar=gate(),segundaIniciada=gate(),falhaPrimeira=new ErroRegra("Rollback fictício após INSERT próprio");
 const dir=mkdtempSync(join(tmpdir(),"erp-372-unique-"));let erroInsert:unknown,erroPersistencia:unknown,pidSegundo=0,pidPrimeiro=0;let faseSegunda="transaction.acquire";
 const antes={pessoas:await prisma.pessoa.count(),leads:await prisma.oportunidade.count(),eventos:await prisma.evento.count()};
 const primeira=prisma.$transaction(async tx=>{
  const [pid]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid()::int AS pid`;pidPrimeiro=pid.pid;
  const observado=new Proxy(tx,{get(alvo,p,receptor){const valor=Reflect.get(alvo,p,receptor);if(p!=="contatoWhatsApp")return typeof valor==="function"?valor.bind(alvo):valor;return new Proxy(valor,{get(modelo,acao){const fn=Reflect.get(modelo,acao);if(acao!=="create")return typeof fn==="function"?fn.bind(modelo):fn;return async(...args:unknown[])=>{const dado=await Reflect.apply(fn,modelo,args);criada.liberar();await soltar.promessa;if(modo==="rollback")throw falhaPrimeira;return dado;};}});}}) as Prisma.TransactionClient;
  return criarRamoNovoConversaTx(observado,entrada);
 },{timeout:30000}).then(dado=>({dado,erro:null}),erro=>({dado:null,erro}));
 let segunda:Promise<Awaited<typeof primeira>>|undefined;let erroFixture:unknown;
 try{
  expect(await Promise.race([criada.promessa.then(()=>"INSERT"),primeira.then(()=>"TERMINOU")])).toBe("INSERT");
  segunda=prisma.$transaction(async tx=>{
   const [pid]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid()::int AS pid`;pidSegundo=pid.pid;segundaIniciada.liberar();
   const observado=new Proxy(tx,{get(alvo,p,receptor){const valor=Reflect.get(alvo,p,receptor);if(p!=="contatoWhatsApp")return typeof valor==="function"?valor.bind(alvo):valor;return new Proxy(valor,{get(modelo,acao){const fn=Reflect.get(modelo,acao);if(acao!=="create")return typeof fn==="function"?fn.bind(modelo):fn;return async(...args:unknown[])=>{faseSegunda="contatoWhatsApp.create";try{return await Reflect.apply(fn,modelo,args);}catch(erro){erroInsert=erro;try{writeFileSync(join(dir,"insert-error.json"),JSON.stringify({fase:"contatoWhatsApp.create",erro:sanitizar(erro)}),{encoding:"utf8",flag:"wx"});}catch(instrumental){erroPersistencia=instrumental;}throw erro;}};}});}}) as Prisma.TransactionClient;
   return criarRamoNovoConversaTx(observado,{...entrada,chaveIdempotencia:`native372-unique-segunda-${i}`});
  },{timeout:30000}).then(dado=>({dado,erro:null}),erro=>({dado:null,erro}));
  expect(await Promise.race([segundaIniciada.promessa.then(()=>"INICIO"),segunda.then(()=>"TERMINOU")])).toBe("INICIO");
  await prisma.$transaction(async observador=>{
   const [obs]=await observador.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid()::int AS pid`;
   expect(new Set([pidPrimeiro,pidSegundo,obs.pid]).size).toBe(3);expect(pidPrimeiro).toBeGreaterThan(0);expect(pidSegundo).toBeGreaterThan(0);
   await vi.waitFor(async()=>{
    expect(faseSegunda).toBe("contatoWhatsApp.create");
    const [r]=await observador.$queryRaw<{esperaExata:boolean}[]>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity a WHERE a.pid=${pidSegundo}::int AND a.datname=current_database() AND a.state='active' AND a.wait_event_type='Lock' AND ${pidPrimeiro}::int=ANY(pg_blocking_pids(a.pid)) AND a.query LIKE 'INSERT INTO "public"."ContatoWhatsApp"%') AS "esperaExata"`;
    expect(r.esperaExata).toBe(true);
   },{timeout:5000,interval:20});
  },{timeout:10000});
 }catch(erro){erroFixture=erro;}finally{soltar.liberar();}
 const r1=await primeira,r2=segunda?await segunda:null;
 if(erroPersistencia)throw new AggregateError(erroInsert?[erroInsert,erroPersistencia]:[erroPersistencia],"Falha instrumental ao persistir diagnóstico sanitizado");
 if(erroFixture)throw erroFixture;expect(r2).not.toBeNull();
 if(modo==="commit"){expect(r1.erro).toBeNull();expect(r2!.erro).toBeInstanceOf(ErroRegra);expect(erroInsert).toBeDefined();}
 else{expect(r1.erro).toBe(falhaPrimeira);expect(r2!.erro).toBeNull();expect(erroInsert).toBeUndefined();}
 expect(await prisma.contatoWhatsApp.count({where:{telefoneE164:entrada.telefoneE164}})).toBe(1);expect(await prisma.oportunidade.count()).toBe(antes.leads+1);expect(await prisma.pessoa.count()).toBe(antes.pessoas+1);expect(await prisma.evento.count()).toBe(antes.eventos+5);
 const vencedor=(modo==="commit"?r1:r2)!;const a=await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:vencedor.dado!.atendimentoId},include:{conversa:{include:{contato:true}}}});expect(a.leadId).toBe(vencedor.dado!.leadId);const contato=a.conversa.contato;if(!contato)throw new Error("Canário: conversa criada sem contato");expect(contato.leadId).toBe(a.leadId);
 expect(await prisma.intencaoMensagem.count()).toBe(0);expect(await prisma.mensagemWhatsApp.count()).toBe(0);
});