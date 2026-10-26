import { beforeAll, expect, it } from "vitest";
import { PrismaClient, Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { protegerTransacoes } from "@/lib/transacao-confirmada";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarRamoNovoConversaTx, type EntradaRamoNovoConversa } from "./nova-conversa-novo";
let entrada:EntradaRamoNovoConversa;
let coreEmExecucao=false,consultasGlobaisDuranteCore=0;
prisma.$use(async(parametros,proxima)=>{if(coreEmExecucao){consultasGlobaisDuranteCore++;throw new Error("Core pool1 tentou consulta pelo singleton global");}return proxima(parametros);});
beforeAll(async()=>{
 await truncarBanco();const u=await criarUsuario([Papel.VENDEDOR],"Vendedor fictício pool1");
 const n=await prisma.numeroWhatsApp.create({data:{telefoneE164:"+50689991111",rotulo:"Linha fictícia pool1",driver:"MOTOR",sessao:"DESCONECTADO",finalidade:"VENDAS",ativo:true,donoId:u.id}});
 entrada={autorId:u.id,ownerId:u.id,numeroId:n.id,telefoneE164:"+50687771111",chaveIdempotencia:"native372-pool1-completo"};
});
it("NOVO e replay real usam apenas a TX pool1, com Pessoa/código/eventos reais",async()=>{
 const url=new URL(process.env.DATABASE_URL!);url.searchParams.set("connection_limit","1");url.searchParams.set("pool_timeout","2");
 const db=protegerTransacoes(new PrismaClient({datasources:{db:{url:url.toString()}}}));
 try{
  let leituras=0,escritas=0;
  coreEmExecucao=true;await expect(prisma.$queryRaw`SELECT 1::int AS ok`).rejects.toThrow("Core pool1 tentou consulta pelo singleton global");coreEmExecucao=false;expect(consultasGlobaisDuranteCore).toBe(1);consultasGlobaisDuranteCore=0;
  coreEmExecucao=true;
  const primeiro=await db.$transaction(async tx=>{
   const canario=await tx.$queryRaw<{ok:number}[]>`SELECT 1::int AS ok`;expect(canario).toEqual([{ok:1}]);
   const observado=new Proxy(tx,{get(alvo,p,receptor){const valor=Reflect.get(alvo,p,receptor);if(!valor||typeof valor!=="object")return typeof valor==="function"?valor.bind(alvo):valor;return new Proxy(valor,{get(modelo,acao){const fn=Reflect.get(modelo,acao);if(typeof fn!=="function")return fn;return(...args:unknown[])=>{if(String(acao).startsWith("find"))leituras++;if(["create","updateMany","upsert"].includes(String(acao)))escritas++;return Reflect.apply(fn,modelo,args);};}});}});
   return criarRamoNovoConversaTx(observado,entrada);
  },{timeout:30000});
  coreEmExecucao=false;expect(consultasGlobaisDuranteCore).toBe(0);
  expect(leituras).toBeGreaterThan(0);expect(escritas).toBeGreaterThan(0);
  const a=await db.atendimentoWhatsApp.findUniqueOrThrow({where:{id:primeiro.atendimentoId},include:{lead:true,conversa:{include:{contato:true}}}});
  expect(a).toMatchObject({responsavelId:entrada.autorId,status:"EM_ATENDIMENTO",finalidade:"COMERCIAL",leadId:primeiro.leadId});
  expect(a.lead).toMatchObject({origemCanal:"PROSPECCAO_ATIVA",nome:"Contato WhatsApp",vendedorDonoId:entrada.ownerId});const contato=a.conversa.contato;if(!contato)throw new Error("Canário: conversa criada sem contato");expect(contato.pessoaId).toBe(a.lead!.pessoaId);
  expect((await db.contador.findUniqueOrThrow({where:{chave:"lead"}})).valor).toBe(1);
  const eventos=await db.evento.count(),pessoas=await db.pessoa.count();
  coreEmExecucao=true;
  expect(await db.$transaction(tx=>criarRamoNovoConversaTx(tx,entrada),{timeout:30000})).toEqual(primeiro);
  coreEmExecucao=false;expect(consultasGlobaisDuranteCore).toBe(0);
  expect(await db.evento.count()).toBe(eventos);expect(await db.pessoa.count()).toBe(pessoas);expect(await db.oportunidade.count()).toBe(1);
  expect(await db.intencaoMensagem.count()).toBe(0);expect(await db.mensagemWhatsApp.count()).toBe(0);
 }finally{coreEmExecucao=false;await db.$disconnect();}
});