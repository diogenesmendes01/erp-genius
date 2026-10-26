import { beforeAll, expect, it, vi } from "vitest";
import { Papel, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { garantirPessoaTx } from "@/server/crm/pessoas";
import { ErroRegra } from "@/server/_shared/sessao";
import { criarRamoNovoConversaTx, type EntradaRamoNovoConversa } from "./nova-conversa-novo";
const gate=()=>{let liberar!:()=>void;const promessa=new Promise<void>(r=>{liberar=r;});return{promessa,liberar};};
let usuarioId:string,numeroId:string;
beforeAll(async()=>{await truncarBanco();usuarioId=(await criarUsuario([Papel.VENDEDOR],"Vendedor fictício CRM")).id;numeroId=(await prisma.numeroWhatsApp.create({data:{telefoneE164:"+50689994444",rotulo:"Linha fictícia CRM",driver:"MOTOR",sessao:"DESCONECTADO",finalidade:"VENDAS",ativo:true,donoId:usuarioId}})).id;});
it.each(["crmPrimeiro","novoPrimeiro"] as const)("CRM phone real e NOVO %s não deixam tupla parcial",async(modo)=>{
 const i=modo==="crmPrimeiro"?1:2,e:EntradaRamoNovoConversa={autorId:usuarioId,ownerId:usuarioId,numeroId,telefoneE164:`+5068777444${i}`,chaveIdempotencia:`native372-crm-phone-${i}`};
 const contatoNovo=gate(),liberarNovo=gate(),crmUpsert=gate(),liberarCRM=gate();let pidNovo=0,pidCRM=0,faseCRM="inicio";
 const antes={pessoas:await prisma.pessoa.count(),eventos:await prisma.evento.count(),leads:await prisma.oportunidade.count()};
 const iniciarCRM=()=>prisma.$transaction(async tx=>{
  const [pid]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid()::int AS pid`;pidCRM=pid.pid;
  const observado=new Proxy(tx,{get(alvo,p,receptor){const v=Reflect.get(alvo,p,receptor);if(p!=="contatoWhatsApp")return typeof v==="function"?v.bind(alvo):v;return new Proxy(v,{get(m,a){const fn=Reflect.get(m,a);if(a!=="upsert")return typeof fn==="function"?fn.bind(m):fn;return async(...args:unknown[])=>{faseCRM="contatoWhatsApp.upsert";crmUpsert.liberar();if(modo==="crmPrimeiro")await liberarCRM.promessa;return Reflect.apply(fn,m,args);};}});}}) as Prisma.TransactionClient;
  return garantirPessoaTx(observado,{nome:"Pessoa CRM fictícia",telefoneE164:e.telefoneE164},usuarioId);
 },{timeout:30000}).then(dado=>({dado,erro:null}),erro=>({dado:null,erro}));
 const iniciarNovo=()=>prisma.$transaction(async tx=>{
  const [pid]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid()::int AS pid`;pidNovo=pid.pid;
  const observado=new Proxy(tx,{get(alvo,p,receptor){const v=Reflect.get(alvo,p,receptor);if(p!=="contatoWhatsApp")return typeof v==="function"?v.bind(alvo):v;return new Proxy(v,{get(m,a){const fn=Reflect.get(m,a);if(a!=="create")return typeof fn==="function"?fn.bind(m):fn;return async(...args:unknown[])=>{const r=await Reflect.apply(fn,m,args);contatoNovo.liberar();if(modo==="novoPrimeiro")await liberarNovo.promessa;return r;};}});}}) as Prisma.TransactionClient;
  return criarRamoNovoConversaTx(observado,e);
 },{timeout:30000}).then(dado=>({dado,erro:null}),erro=>({dado:null,erro}));
 let crm:ReturnType<typeof iniciarCRM>|undefined,novo:ReturnType<typeof iniciarNovo>|undefined,erroFixture:unknown;
 try{
  if(modo==="crmPrimeiro"){
   crm=iniciarCRM();expect(await Promise.race([crmUpsert.promessa.then(()=>"UPSERT"),crm.then(()=>"TERMINOU")])).toBe("UPSERT");novo=iniciarNovo();expect((await novo).erro).toBeInstanceOf(ErroRegra);
  }else{
   novo=iniciarNovo();expect(await Promise.race([contatoNovo.promessa.then(()=>"INSERT"),novo.then(()=>"TERMINOU")])).toBe("INSERT");crm=iniciarCRM();expect(await Promise.race([crmUpsert.promessa.then(()=>"UPSERT"),crm.then(()=>"TERMINOU")])).toBe("UPSERT");
   await prisma.$transaction(async obs=>{const [p]=await obs.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid()::int AS pid`;expect(new Set([p.pid,pidNovo,pidCRM]).size).toBe(3);await vi.waitFor(async()=>{expect(faseCRM).toBe("contatoWhatsApp.upsert");const [r]=await obs.$queryRaw<{espera:boolean}[]>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity a WHERE a.pid=${pidCRM}::int AND a.datname=current_database() AND a.wait_event_type='Lock' AND ${pidNovo}::int=ANY(pg_blocking_pids(a.pid)) AND (a.query LIKE 'INSERT INTO "public"."ContatoWhatsApp"%' OR a.query LIKE 'UPDATE "public"."ContatoWhatsApp"%')) AS espera`;expect(r.espera).toBe(true);},{timeout:5000,interval:20});},{timeout:10000});
   liberarNovo.liberar();expect((await novo).erro).toBeInstanceOf(ErroRegra);
  }
 }catch(erro){erroFixture=erro;}finally{liberarNovo.liberar();liberarCRM.liberar();}
 const rn=novo?await novo:null,rc=crm?await crm:null;if(erroFixture)throw erroFixture;expect(rn!.erro).toBeInstanceOf(ErroRegra);expect(rc!.erro).toBeNull();
 expect(await prisma.oportunidade.count()).toBe(antes.leads);expect(await prisma.pessoa.count()).toBe(antes.pessoas+1);expect(await prisma.evento.count()).toBe(antes.eventos+1);
 expect(await prisma.contatoWhatsApp.findUniqueOrThrow({where:{telefoneE164:e.telefoneE164}})).toMatchObject({pessoaId:rc!.dado!.pessoaId,leadId:null,alunoId:null,responsavelId:null});
 expect(await prisma.conversaWhatsApp.count()).toBe(0);expect(await prisma.atendimentoWhatsApp.count()).toBe(0);expect(await prisma.intencaoMensagem.count()).toBe(0);expect(await prisma.mensagemWhatsApp.count()).toBe(0);
});