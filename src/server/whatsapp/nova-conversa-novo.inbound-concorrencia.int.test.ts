import { beforeAll, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Papel, type Prisma } from "@prisma/client";
const agendamentos=vi.hoisted(()=>({turno:vi.fn(),triagem:vi.fn()}));
vi.mock("@/server/aria/turno/orquestrador",()=>({agendarTurnoAria:agendamentos.turno}));
vi.mock("@/server/aria/triagem",()=>({agendarTriagemAria:agendamentos.triagem}));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { ErroRegra } from "@/server/_shared/sessao";
import { processarMensagemNormalizada } from "./inbound";
import { criarRamoNovoConversaTx, type EntradaRamoNovoConversa } from "./nova-conversa-novo";
const gate=()=>{let liberar!:()=>void;const promessa=new Promise<void>(r=>{liberar=r;});return{promessa,liberar};};
let usuarioId:string,numeroId:string;const telefoneLinha="+50689995555";
beforeAll(async()=>{await truncarBanco();usuarioId=(await criarUsuario([Papel.VENDEDOR],"Vendedor fictício inbound")).id;numeroId=(await prisma.numeroWhatsApp.create({data:{telefoneE164:telefoneLinha,rotulo:"Linha fictícia inbound",driver:"MOTOR",sessao:"DESCONECTADO",finalidade:"VENDAS",ativo:true,donoId:usuarioId}})).id;});
it.each(["inboundPrimeiro","novoPrimeiro"] as const)("inbound real %s preserva bindings sem envio externo",async(modo)=>{
 const i=modo==="inboundPrimeiro"?1:2,e:EntradaRamoNovoConversa={autorId:usuarioId,ownerId:usuarioId,numeroId,telefoneE164:`+5068777555${i}`,chaveIdempotencia:`native372-inbound-${i}`};
 const original=prisma.$transaction.bind(prisma),primeiroInsert=gate(),liberar=gate(),inboundInicio=gate(),novoCreateInicio=gate();let pidNovo=0,pidInbound=0,faseInbound="inicio",faseNovo="inicio",novoTerminou=false,inboundTerminou=false;
 const diagnostico=mkdtempSync(join(tmpdir(),"erp-372-inbound-"));
 const antes={leads:await prisma.oportunidade.count(),pessoas:await prisma.pessoa.count(),mensagens:await prisma.mensagemWhatsApp.count()};
 const passar=((operacao:unknown,opcoes:unknown)=>{
  if(typeof operacao!=="function")return Reflect.apply(original,prisma,[operacao,opcoes]);
  return original(async tx=>{
   const [p]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid()::int AS pid`;pidInbound=p.pid;inboundInicio.liberar();
   const observado=new Proxy(tx,{get(alvo,p,receptor){const v=Reflect.get(alvo,p,receptor);if(p!=="contatoWhatsApp")return typeof v==="function"?v.bind(alvo):v;return new Proxy(v,{get(m,a){const fn=Reflect.get(m,a);if(a!=="create")return typeof fn==="function"?fn.bind(m):fn;return async(...args:unknown[])=>{faseInbound="contatoWhatsApp.create";let r:unknown;try{r=await Reflect.apply(fn,m,args);}catch(erro){const campo=(v:unknown)=>typeof v==="string"&&/^[A-Za-z0-9_$][A-Za-z0-9_$.[\]]{0,100}$/.test(v)?v:null;const obj=erro&&typeof erro==="object"?erro:null,meta=obj?Reflect.get(obj,"meta"):null;const seguro={fase:"contatoWhatsApp.create",name:obj?campo(Reflect.get(obj,"name")):null,code:obj?campo(Reflect.get(obj,"code")):null,meta:meta&&typeof meta==="object"?{modelName:campo(Reflect.get(meta,"modelName")),target:Array.isArray(Reflect.get(meta,"target"))?Reflect.get(meta,"target").map(campo):campo(Reflect.get(meta,"target"))}:null};try{writeFileSync(join(diagnostico,"contact-error.json"),JSON.stringify(seguro),{encoding:"utf8",flag:"wx"});}catch(instrumental){throw new AggregateError([erro,instrumental],"Falha instrumental ao persistir erro inbound");}throw erro;}if(modo==="inboundPrimeiro"){primeiroInsert.liberar();await liberar.promessa;}return r;};}});}}) as Prisma.TransactionClient;
   return Reflect.apply(operacao,undefined,[observado]);
  },opcoes as Parameters<typeof original>[1]);
 }) as typeof prisma.$transaction;
 const spy=vi.spyOn(prisma,"$transaction").mockImplementation(passar);
 const iniciarInbound=()=>processarMensagemNormalizada({numeroTelefoneE164:telefoneLinha,driver:"MOTOR",contatoWaId:e.telefoneE164.slice(1),providerMessageId:`native372-inbound-provider-${i}`,corpo:"Mensagem fictícia recebida",tipo:"TEXTO",fromMe:false,quando:new Date()}).then(dado=>{inboundTerminou=true;return{dado,erro:null};},erro=>{inboundTerminou=true;return{dado:null,erro};});
 const iniciarNovo=()=>original(async tx=>{
  const [p]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid()::int AS pid`;pidNovo=p.pid;
  const observado=new Proxy(tx,{get(alvo,p,receptor){const v=Reflect.get(alvo,p,receptor);if(p!=="contatoWhatsApp")return typeof v==="function"?v.bind(alvo):v;return new Proxy(v,{get(m,a){const fn=Reflect.get(m,a);if(a!=="create")return typeof fn==="function"?fn.bind(m):fn;return async(...args:unknown[])=>{faseNovo="contatoWhatsApp.create";novoCreateInicio.liberar();const r=await Reflect.apply(fn,m,args);if(modo==="novoPrimeiro"){primeiroInsert.liberar();await liberar.promessa;}return r;};}});}}) as Prisma.TransactionClient;
  return criarRamoNovoConversaTx(observado,e);
 },{timeout:30000}).then(dado=>{novoTerminou=true;return{dado,erro:null};},erro=>{novoTerminou=true;return{dado:null,erro};});
 let inbound:ReturnType<typeof iniciarInbound>|undefined,novo:ReturnType<typeof iniciarNovo>|undefined,erroFixture:unknown;
 try{
  if(modo==="inboundPrimeiro"){inbound=iniciarInbound();expect(await Promise.race([primeiroInsert.promessa.then(()=>"INSERT"),inbound.then(()=>"TERMINOU")])).toBe("INSERT");novo=iniciarNovo();}
  else{novo=iniciarNovo();expect(await Promise.race([primeiroInsert.promessa.then(()=>"INSERT"),novo.then(()=>"TERMINOU")])).toBe("INSERT");inbound=iniciarInbound();}
  expect(await Promise.race([inboundInicio.promessa.then(()=>"INBOUND"),inbound!.then(()=>"TERMINOU")])).toBe("INBOUND");
  if(modo==="inboundPrimeiro")expect(await Promise.race([novoCreateInicio.promessa.then(()=>"CREATE"),novo!.then(()=>"TERMINOU")])).toBe("CREATE");
  await original(async obs=>{const [p]=await obs.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid()::int AS pid`;
   await vi.waitFor(async()=>{await obs.$executeRaw`SELECT pg_stat_clear_snapshot()`;expect(novoTerminou).toBe(false);expect(inboundTerminou).toBe(false);if(modo==="inboundPrimeiro")expect(faseNovo).toBe("contatoWhatsApp.create");expect(pidNovo).toBeGreaterThan(0);expect(new Set([p.pid,pidNovo,pidInbound]).size).toBe(3);if(modo==="novoPrimeiro")expect(faseInbound).toBe("contatoWhatsApp.create");const bloqueado=modo==="novoPrimeiro"?pidInbound:pidNovo,bloqueador=modo==="novoPrimeiro"?pidNovo:pidInbound;const [r]=await obs.$queryRaw<{espera:boolean}[]>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity a WHERE a.pid=${bloqueado}::int AND a.datname=current_database() AND a.state='active' AND a.wait_event_type='Lock' AND ${bloqueador}::int=ANY(pg_blocking_pids(a.pid)) AND a.query LIKE 'INSERT INTO "public"."ContatoWhatsApp"%') AS espera`;writeFileSync(join(diagnostico,"observer.json"),JSON.stringify({modo,faseNovo,faseInbound,novoTerminou,inboundTerminou,tresPids:new Set([p.pid,pidNovo,pidInbound]).size===3,bloqueioEsperado:r.espera}),{encoding:"utf8"});expect(r.espera).toBe(true);},{timeout:5000,interval:20});
  },{timeout:10000});
 }catch(erro){erroFixture=erro;}finally{liberar.liberar();}
 const rn=novo?await novo:null,ri=inbound?await inbound:null;spy.mockRestore();if(erroFixture)throw erroFixture;expect(ri!.erro).toBeNull();
 if(modo==="inboundPrimeiro"){expect(ri!.dado).toBe("gravada");expect(rn!.erro).toBeInstanceOf(ErroRegra);expect(await prisma.oportunidade.count()).toBe(antes.leads);expect(await prisma.pessoa.count()).toBe(antes.pessoas);expect(await prisma.mensagemWhatsApp.count()).toBe(antes.mensagens+1);expect(await prisma.evento.count({where:{tipo:"ConversaIniciadaPorNumero"}})).toBe(0);}
 else{expect(ri!.dado).toBe("gravada");expect(rn!.erro).toBeNull();expect(await prisma.oportunidade.count()).toBe(antes.leads+1);expect(await prisma.pessoa.count()).toBe(antes.pessoas+1);expect(await prisma.mensagemWhatsApp.count()).toBe(antes.mensagens+1);expect(await prisma.mensagemWhatsApp.count({where:{numeroId,providerMessageId:`native372-inbound-provider-${i}`}})).toBe(1);const c=await prisma.contatoWhatsApp.findUniqueOrThrow({where:{telefoneE164:e.telefoneE164}});expect(c.leadId).toBe(rn!.dado!.leadId);}
 expect(await prisma.contatoWhatsApp.count({where:{telefoneE164:e.telefoneE164}})).toBe(1);expect(await prisma.intencaoMensagem.count()).toBe(0);
});
it("dedupe inbound exige providerMessageId já persistido, sem perder provider novo",async()=>{
 const entrada={numeroTelefoneE164:telefoneLinha,driver:"MOTOR" as const,contatoWaId:"50687775553",providerMessageId:"native372-inbound-provider-dedupe",corpo:"Mensagem fictícia de dedupe",tipo:"TEXTO" as const,fromMe:false,quando:new Date()};
 expect(await processarMensagemNormalizada(entrada)).toBe("gravada");
 expect(await processarMensagemNormalizada(entrada)).toBe("duplicada");
 expect(await prisma.mensagemWhatsApp.count({where:{numeroId,providerMessageId:entrada.providerMessageId}})).toBe(1);
 expect(await processarMensagemNormalizada({...entrada,providerMessageId:"native372-inbound-provider-outro"})).toBe("gravada");
 expect(await prisma.mensagemWhatsApp.count({where:{numeroId,providerMessageId:{in:[entrada.providerMessageId,"native372-inbound-provider-outro"]}}})).toBe(2);
});