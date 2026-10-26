import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Papel, type Prisma } from "@prisma/client";
const sessao=vi.hoisted(()=>({id:""}));
vi.mock("@/server/_shared/sessao",async original=>{const o=await original<typeof import("@/server/_shared/sessao")>();return{...o,exigirSessao:async()=>{const u=await o.carregarUsuarioFresco(sessao.id);if(!u)throw new o.ErroAutenticacao();return u;}};});
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { iniciarConversaPorNumero } from "./nova-conversa-acoes";
// AUTORADO/NÃO EXECUTADO. Pausas apenas ao redor de chamadas reais; nenhuma consulta/helper substituído.
let vendedor:Awaited<ReturnType<typeof criarUsuario>>,fora:Awaited<ReturnType<typeof criarUsuario>>,numeroId:string,seq=0;
const tel=(n:number)=>`+5068555${String(n).padStart(4,"0")}`;
const gate=()=>{let liberar!:()=>void;const promessa=new Promise<void>(r=>{liberar=r;});return{promessa,liberar};};
async function criarLead(telefoneE164:string){const pessoa=await prisma.pessoa.create({data:{nome:"Pessoa fictícia concorrência EX"}});const lead=await prisma.oportunidade.create({data:{codigo:`L-EXC-${++seq}`,nome:"Lead fictício concorrência EX",telefoneE164,pessoaId:pessoa.id,vendedorDonoId:vendedor.id}});return{pessoa,lead};}
async function snapshot(){return{pessoas:await prisma.pessoa.findMany({orderBy:{id:"asc"}}),leads:await prisma.oportunidade.findMany({orderBy:{id:"asc"}}),contatos:await prisma.contatoWhatsApp.findMany({orderBy:{id:"asc"}}),conversas:await prisma.conversaWhatsApp.findMany({orderBy:{id:"asc"}}),atendimentos:await prisma.atendimentoWhatsApp.findMany({orderBy:{id:"asc"}}),eventos:await prisma.evento.findMany({orderBy:{id:"asc"}}),mensagens:await prisma.mensagemWhatsApp.count(),intencoes:await prisma.intencaoMensagem.count()};}
function instrumentar(fase:"ultimoAwaitACL"|"cas"){
 const pronto=gate(),soltar=gate(),original=prisma.$transaction.bind(prisma);let setReal=false,pausou=false,pid=0,fotos=0,casCount:number|undefined,chamadasTx=0;
 const spy=vi.spyOn(prisma,"$transaction").mockImplementation(((operacao:unknown,opcoes:unknown)=>{
  if(typeof operacao!=="function")return Reflect.apply(original,prisma,[operacao,opcoes]);chamadasTx++;
  return original(async tx=>{const[p]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid()::int AS pid`;pid=p.pid;
   const observado=new Proxy(tx,{get(alvo,chave,receptor){const valor=Reflect.get(alvo,chave,receptor);
    if(chave==="$executeRaw")return async(...args:unknown[])=>{const r=await Reflect.apply(valor,alvo,args),tag=args[0];if(Array.isArray(tag)&&tag.join("").trim()==="SET CONSTRAINTS ALL IMMEDIATE")setReal=true;return r;};
    if(chave==="$queryRaw")return async(...args:unknown[])=>{const r=await Reflect.apply(valor,alvo,args),tag=args[0];if(Array.isArray(tag)&&tag.join("").includes("AS foto")){fotos++;expect(r).toHaveLength(1);}return r;};
    if(chave==="atendimentoWhatsApp"||chave==="contatoWhatsApp")return new Proxy(valor,{get(modelo,acao){const fn=Reflect.get(modelo,acao);if(typeof fn!=="function")return fn;
     if(chave==="atendimentoWhatsApp"&&acao==="findFirst")return async(...args:unknown[])=>{const r=await Reflect.apply(fn,modelo,args);if(fase==="ultimoAwaitACL"&&setReal&&!pausou){expect(r).not.toBeNull();pausou=true;pronto.liberar();await soltar.promessa;}return r;};
     if(chave==="contatoWhatsApp"&&acao==="updateMany")return async(...args:unknown[])=>{if(fase==="cas"&&!pausou){expect(args[0]).toMatchObject({where:{pessoaId:null,leadId:null,alunoId:null,responsavelId:null}});pausou=true;pronto.liberar();await soltar.promessa;}const r=await Reflect.apply(fn,modelo,args);if(fase==="cas"){if(!r||typeof r!=="object"||!("count" in r)||typeof r.count!=="number")throw new Error("Instrumentação: UPDATE sem contagem real");casCount=r.count;}return r;};
     return fn.bind(modelo);}});
    return typeof valor==="function"?valor.bind(alvo):valor;}}) as Prisma.TransactionClient;
   return Reflect.apply(operacao,undefined,[observado]);},opcoes as Parameters<typeof original>[1]);
 }) as typeof prisma.$transaction);
 return{pronto,soltar,externo:original,parar:()=>spy.mockRestore(),metricas:()=>({setReal,pausou,pid,fotos,casCount,chamadasTx})};
}
let fetchGuard:{mock:{calls:unknown[][]}};
beforeEach(async()=>{vi.restoreAllMocks();fetchGuard=vi.spyOn(globalThis,"fetch").mockImplementation(async()=>{throw new Error("Bloqueio do teste372: tentativa de rede inesperada.");});await truncarBanco();vendedor=await criarUsuario([Papel.VENDEDOR],"Vendedor fictício EX concorrência");fora=await criarUsuario([Papel.VENDEDOR],"Fora fictício EX concorrência");sessao.id=vendedor.id;numeroId=(await prisma.numeroWhatsApp.create({data:{telefoneE164:"+50689993332",rotulo:"Linha fictícia EX concorrência",driver:"MOTOR",sessao:"DESCONECTADO",finalidade:"VENDAS",donoId:vendedor.id,ativo:true}})).id;});
afterEach(()=>{try{expect(fetchGuard).not.toHaveBeenCalled();}finally{vi.restoreAllMocks();}});
it.each(["ativo","perfil","linha"] as const)("revogação %s no último await ACL usa batch SQL fresco e rollback integral",async(caso)=>{
 const telefone=tel(1);await criarLead(telefone);const antes=await snapshot(),o=instrumentar("ultimoAwaitACL"),fetchSpy=vi.spyOn(globalThis,"fetch").mockImplementation(async()=>{throw new Error("Bloqueio do teste372: tentativa de rede inesperada.");});
 const tarefa=iniciarConversaPorNumero({modo:"EXISTENTE",telefone,numeroId,chaveIdempotencia:`ex-revoga-final-${caso}-372`}).then(dado=>({dado,erro:null}),erro=>({dado:null,erro}));let fixtureErro:unknown,pidMutacao=0,resultado:Awaited<typeof tarefa>;
 try{
  expect(await Promise.race([o.pronto.promessa.then(()=>"ULTIMO_AWAIT"),tarefa.then(()=>"TERMINOU")])).toBe("ULTIMO_AWAIT");expect(o.metricas()).toMatchObject({setReal:true,pausou:true,chamadasTx:1});expect(o.metricas().fotos).toBeGreaterThanOrEqual(1);
  await o.externo(async tx=>{const[p]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid()::int AS pid`;pidMutacao=p.pid;expect(pidMutacao).not.toBe(o.metricas().pid);if(caso==="ativo")await tx.usuario.update({where:{id:vendedor.id},data:{ativo:false}});else if(caso==="perfil")await tx.usuario.update({where:{id:vendedor.id},data:{papeis:[]}});else await tx.numeroWhatsApp.update({where:{id:numeroId},data:{donoId:fora.id}});});
 }catch(erro){fixtureErro=erro;}finally{o.soltar.liberar();resultado=await tarefa;o.parar();}
 if(fixtureErro)throw fixtureErro;expect(resultado!.erro).toBeNull();expect(resultado!.dado?.ok).toBe(false);expect(o.metricas().fotos).toBeGreaterThanOrEqual(2);expect(o.metricas().chamadasTx).toBe(1);expect(pidMutacao).toBeGreaterThan(0);expect(await snapshot()).toEqual(antes);expect(fetchSpy).not.toHaveBeenCalled();
 if(caso==="ativo")expect((await prisma.usuario.findUniqueOrThrow({where:{id:vendedor.id}})).ativo).toBe(false);else if(caso==="perfil")expect((await prisma.usuario.findUniqueOrThrow({where:{id:vendedor.id}})).papeis).toEqual([]);else expect((await prisma.numeroWhatsApp.findUniqueOrThrow({where:{id:numeroId}})).donoId).toBe(fora.id);
});
it("null-map CAS real perde para vínculo concorrente e não sobrescreve nem cria parcial",async()=>{
 const telefone=tel(2),l=await criarLead(telefone),c=await prisma.contatoWhatsApp.create({data:{telefoneE164:telefone}}),pessoaConcorrente=await prisma.pessoa.create({data:{nome:"Pessoa concorrente fictícia"}}),antes=await snapshot(),o=instrumentar("cas"),fetchSpy=vi.spyOn(globalThis,"fetch").mockImplementation(async()=>{throw new Error("Bloqueio do teste372: tentativa de rede inesperada.");});
 const tarefa=iniciarConversaPorNumero({modo:"EXISTENTE",telefone,numeroId,chaveIdempotencia:"ex-cas-perdido-372"}).then(dado=>({dado,erro:null}),erro=>({dado:null,erro}));let fixtureErro:unknown,resultado:Awaited<typeof tarefa>,pidMutacao=0;
 try{expect(await Promise.race([o.pronto.promessa.then(()=>"CAS"),tarefa.then(()=>"TERMINOU")])).toBe("CAS");await o.externo(async tx=>{const[p]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid()::int AS pid`;pidMutacao=p.pid;expect(pidMutacao).not.toBe(o.metricas().pid);await tx.contatoWhatsApp.update({where:{id:c.id},data:{pessoaId:pessoaConcorrente.id}});});}
 catch(erro){fixtureErro=erro;}finally{o.soltar.liberar();resultado=await tarefa;o.parar();}
 if(fixtureErro)throw fixtureErro;expect(resultado!.erro).toBeNull();expect(resultado!.dado?.ok).toBe(false);expect(o.metricas()).toMatchObject({pausou:true,casCount:0,chamadasTx:1});expect(pidMutacao).toBeGreaterThan(0);
 const depois=await snapshot();expect(depois.pessoas).toEqual(antes.pessoas);expect(depois.leads).toEqual(antes.leads);expect(depois.conversas).toEqual(antes.conversas);expect(depois.atendimentos).toEqual(antes.atendimentos);expect(depois.eventos).toEqual(antes.eventos);expect(depois.mensagens).toBe(antes.mensagens);expect(depois.intencoes).toBe(antes.intencoes);expect(await prisma.contatoWhatsApp.findUniqueOrThrow({where:{id:c.id}})).toMatchObject({telefoneE164:telefone,pessoaId:pessoaConcorrente.id,leadId:null});expect((await prisma.oportunidade.findUniqueOrThrow({where:{id:l.lead.id}})).pessoaId).toBe(l.pessoa.id);expect(fetchSpy).not.toHaveBeenCalled();
});