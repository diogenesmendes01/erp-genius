import { beforeAll, expect, it, vi } from "vitest";
import { Papel, type Prisma } from "@prisma/client";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
vi.mock("@/server/aria/turno/orquestrador",()=>({agendarTurnoAria:vi.fn()}));
vi.mock("@/server/aria/triagem",()=>({agendarTriagemAria:vi.fn()}));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { processarMensagemNormalizada, type InboundNormalizado } from "./inbound";
const gate=()=>{let liberar!:()=>void;const promessa=new Promise<void>(r=>{liberar=r;});return{promessa,liberar};};
let numeroId:string;const telefoneLinha="+50689998888";
beforeAll(async()=>{await truncarBanco();const u=await criarUsuario([Papel.VENDEDOR],"Vendedor fictício provider");numeroId=(await prisma.numeroWhatsApp.create({data:{telefoneE164:telefoneLinha,rotulo:"Linha fictícia provider",driver:"MOTOR",sessao:"DESCONECTADO",finalidade:"VENDAS",ativo:true,donoId:u.id}})).id;for(const telefoneE164 of["+50687778881","+50687778882"]){const c=await prisma.contatoWhatsApp.create({data:{telefoneE164}});await prisma.conversaWhatsApp.create({data:{numeroId,contatoId:c.id}});}});
it("provider mesmo número concorrente: P2002 é Mensagem e uma linha persistida confirma dedupe",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"erp-372-provider-")),original=prisma.$transaction.bind(prisma),pronto=gate(),liberar=gate(),segundoInicio=gate();let chamadas=0,pid1=0,pid2=0,fase2="inicio",erroMensagem:unknown,erroPersistencia:unknown;
 const token=(v:unknown)=>typeof v==="string"&&/^[A-Za-z0-9_$][A-Za-z0-9_$.[\]]{0,100}$/.test(v)?v:null;
 const passar=((operacao:unknown,opcoes:unknown)=>{if(typeof operacao!=="function")return Reflect.apply(original,prisma,[operacao,opcoes]);const ordem=++chamadas;return original(async tx=>{
  const [p]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid()::int AS pid`;if(ordem===1)pid1=p.pid;else{pid2=p.pid;segundoInicio.liberar();}
  const observado=new Proxy(tx,{get(alvo,p,receptor){const v=Reflect.get(alvo,p,receptor);if(p!=="mensagemWhatsApp")return typeof v==="function"?v.bind(alvo):v;return new Proxy(v,{get(m,a){const fn=Reflect.get(m,a);if(a!=="create")return typeof fn==="function"?fn.bind(m):fn;return async(...args:unknown[])=>{if(ordem===2)fase2="mensagemWhatsApp.create";let r:unknown;try{r=await Reflect.apply(fn,m,args);}catch(erro){if(ordem===2){erroMensagem=erro;const obj=erro&&typeof erro==="object"?erro:null,meta=obj?Reflect.get(obj,"meta"):null;try{writeFileSync(join(dir,"mensagem-error.json"),JSON.stringify({fase:fase2,name:obj?token(Reflect.get(obj,"name")):null,code:obj?token(Reflect.get(obj,"code")):null,meta:meta&&typeof meta==="object"?{modelName:token(Reflect.get(meta,"modelName")),target:Array.isArray(Reflect.get(meta,"target"))?Reflect.get(meta,"target").map(token):token(Reflect.get(meta,"target"))}:null}),{encoding:"utf8",flag:"wx"});}catch(instrumental){erroPersistencia=instrumental;}}throw erro;}if(ordem===1){pronto.liberar();await liberar.promessa;}return r;};}});}}) as Prisma.TransactionClient;
  return Reflect.apply(operacao,undefined,[observado]);
 },opcoes as Parameters<typeof original>[1]);}) as typeof prisma.$transaction;
 const spy=vi.spyOn(prisma,"$transaction").mockImplementation(passar),m:InboundNormalizado={numeroTelefoneE164:telefoneLinha,driver:"MOTOR",contatoWaId:"50687778881",providerMessageId:"provider-ficticio-concorrente-372",corpo:"Mensagem fictícia provider",tipo:"TEXTO",fromMe:false,quando:new Date()};
 const primeira=processarMensagemNormalizada(m).then(dado=>({dado,erro:null}),erro=>({dado:null,erro}));let segunda:Promise<Awaited<typeof primeira>>|undefined,erroFixture:unknown;
 try{
  expect(await Promise.race([pronto.promessa.then(()=>"INSERT"),primeira.then(()=>"TERMINOU")])).toBe("INSERT");
  // Contatos distintos evitam lock de Conversa anterior à UNIQUE(numeroId,providerMessageId).
  segunda=processarMensagemNormalizada({...m,contatoWaId:"50687778882"}).then(dado=>({dado,erro:null}),erro=>({dado:null,erro}));
  expect(await Promise.race([segundoInicio.promessa.then(()=>"SEGUNDA"),segunda.then(()=>"TERMINOU")])).toBe("SEGUNDA");
  await original(async obs=>{const [p]=await obs.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid()::int AS pid`;expect(new Set([pid1,pid2,p.pid]).size).toBe(3);await vi.waitFor(async()=>{await obs.$executeRaw`SELECT pg_stat_clear_snapshot()`;expect(fase2).toBe("mensagemWhatsApp.create");const [r]=await obs.$queryRaw<{espera:boolean}[]>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity a WHERE a.pid=${pid2}::int AND a.datname=current_database() AND a.state='active' AND a.wait_event_type='Lock' AND ${pid1}::int=ANY(pg_blocking_pids(a.pid)) AND a.query LIKE 'INSERT INTO "public"."MensagemWhatsApp"%') AS espera`;expect(r.espera).toBe(true);},{timeout:5000,interval:20});},{timeout:10000});
 }catch(erro){erroFixture=erro;}finally{liberar.liberar();}
 const r1=await primeira,r2=segunda?await segunda:null;spy.mockRestore();if(erroPersistencia)throw new AggregateError(erroMensagem?[erroMensagem,erroPersistencia]:[erroPersistencia],"Falha instrumental ao persistir erroMensagem");if(erroFixture)throw erroFixture;
 expect(r1.erro).toBeNull();expect(r1.dado).toBe("gravada");expect(r2!.erro).toBeNull();expect(r2!.dado).toBe("duplicada");
 expect(erroMensagem).toMatchObject({code:"P2002",meta:{modelName:"MensagemWhatsApp",target:["numeroId","providerMessageId"]}});
 const mensagens=await prisma.mensagemWhatsApp.findMany({where:{numeroId,providerMessageId:m.providerMessageId}});expect(mensagens).toHaveLength(1);expect(mensagens[0].corpo).toBe(m.corpo);expect(await prisma.intencaoMensagem.count()).toBe(0);
});