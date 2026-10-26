import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { Papel, type Prisma } from "@prisma/client";
const sessao=vi.hoisted(()=>({id:""}));
vi.mock("@/server/_shared/sessao",async original=>{const o=await original<typeof import("@/server/_shared/sessao")>();return{...o,exigirSessao:async()=>{const u=await o.carregarUsuarioFresco(sessao.id);if(!u)throw new o.ErroAutenticacao();return u;}};});
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { listarVendedoresNovaConversa } from "./nova-conversa-vendedores";
type Usuario=Awaited<ReturnType<typeof criarUsuario>>;
let ven:Usuario,equipe:Usuario,gc:Usuario,misto:Usuario,equipeMisto:Usuario,fora:Usuario,admin:Usuario,vazio:Usuario,inativo:Usuario;
let fetchGuard:{mock:{calls:unknown[][]}};
const mensagem="O cadastro ou acesso mudou. Confira o vendedor antes de continuar.";
const gate=()=>{let liberar!:()=>void;const promessa=new Promise<void>(r=>{liberar=r;});return{promessa,liberar};};
const texto=(v:unknown)=>Array.isArray(v)?v.join(""):v&&typeof v==="object"&&typeof Reflect.get(v,"sql")==="string"?String(Reflect.get(v,"sql")):"";
async function foto(){return{usuarios:await prisma.usuario.findMany({orderBy:{id:"asc"}}),pessoas:await prisma.pessoa.findMany({orderBy:{id:"asc"}}),leads:await prisma.oportunidade.findMany({orderBy:{id:"asc"}}),numeros:await prisma.numeroWhatsApp.findMany({orderBy:{id:"asc"}}),contatos:await prisma.contatoWhatsApp.findMany({orderBy:{id:"asc"}}),conversas:await prisma.conversaWhatsApp.findMany({orderBy:{id:"asc"}}),atendimentos:await prisma.atendimentoWhatsApp.findMany({orderBy:{id:"asc"}}),eventos:await prisma.evento.findMany({orderBy:{id:"asc"}}),mensagens:await prisma.mensagemWhatsApp.count(),intencoes:await prisma.intencaoMensagem.count()};}
function observar(pausar=false){
 const original=prisma.$transaction.bind(prisma),pronto=gate(),soltar=gate(),metricas:{pid:number;fotos:number;listas:number;writes:number;pausou:boolean}[]=[];
 const spy=vi.spyOn(prisma,"$transaction").mockImplementation(((operacao:unknown,opcoes:unknown)=>{
  if(typeof operacao!=="function")return Reflect.apply(original,prisma,[operacao,opcoes]);const metrica={pid:0,fotos:0,listas:0,writes:0,pausou:false};metricas.push(metrica);
  return original(async tx=>{metrica.pid=(await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid()::int AS pid`)[0].pid;
   const observado=new Proxy(tx,{get(alvo,chave,receptor){const valor=Reflect.get(alvo,chave,receptor);
    if(chave==="$queryRaw")return async(...args:unknown[])=>{const sql=texto(args[0]),r=await Reflect.apply(valor,alvo,args);if(sql.includes("AS foto")){expect(sql).toContain('FROM "Usuario" v');expect(sql).toContain('LEFT JOIN "Usuario" u');if(!Array.isArray(r))throw Error("Instrumentação: foto SQL não retornou array.");expect(r).toHaveLength(1);expect(r[0]).toHaveProperty("foto.autor.id",sessao.id);metrica.fotos++;}return r;};
    if(chave==="$executeRaw"||chave==="$executeRawUnsafe")return(...args:unknown[])=>{metrica.writes++;return Reflect.apply(valor,alvo,args);};
    if(valor&&typeof valor==="object")return new Proxy(valor,{get(modelo,acao){const fn=Reflect.get(modelo,acao);if(typeof fn!=="function")return fn;return async(...args:unknown[])=>{if(["create","createMany","update","updateMany","upsert","delete","deleteMany"].includes(String(acao)))metrica.writes++;const r=await Reflect.apply(fn,modelo,args);if(chave==="usuario"&&acao==="findMany"){metrica.listas++;expect(args[0]).toMatchObject({where:{ativo:true,papeis:{has:Papel.VENDEDOR}}});if(pausar&&!metrica.pausou){metrica.pausou=true;pronto.liberar();await soltar.promessa;}}return r;};}});
    return typeof valor==="function"?valor.bind(alvo):valor;}}) as Prisma.TransactionClient;
   return Reflect.apply(operacao,undefined,[observado]);},opcoes as Parameters<typeof original>[1]);
 }) as typeof prisma.$transaction);
 return{pronto,soltar,metricas,externo:original,parar:()=>spy.mockRestore()};
}
function conferir(o:ReturnType<typeof observar>){expect(o.metricas.length).toBeGreaterThan(0);for(const m of o.metricas){expect(m.pid).toBeGreaterThan(0);expect(m.fotos).toBe(1);expect(m.listas).toBe(1);expect(m.writes).toBe(0);}}
async function corrida(alterar:(tx:Prisma.TransactionClient)=>Promise<unknown>,esperado:unknown){
 const o=observar(true),tarefa=listarVendedoresNovaConversa().then(dado=>({dado,erro:null}),erro=>({dado:null,erro}));let pidExterno=0,fixtureErro:unknown,depoisMutacao:Awaited<ReturnType<typeof foto>>|undefined,resultado:Awaited<typeof tarefa>|undefined,timer:ReturnType<typeof setTimeout>|undefined;
 try{expect(await Promise.race([o.pronto.promessa.then(()=>"LISTA"),tarefa.then(()=>"TERMINOU"),new Promise<string>(resolve=>{timer=setTimeout(()=>resolve("DEADLINE"),2000);})])).toBe("LISTA");if(timer)clearTimeout(timer);await o.externo(async tx=>{pidExterno=(await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid()::int AS pid`)[0].pid;expect(pidExterno).not.toBe(o.metricas[0].pid);await alterar(tx);});depoisMutacao=await foto();}
 catch(erro){fixtureErro=erro;}finally{if(timer)clearTimeout(timer);o.soltar.liberar();resultado=await tarefa;o.parar();}
 if(fixtureErro)throw fixtureErro;expect(resultado!.erro).toBeNull();expect(resultado!.dado).toEqual(esperado);expect(pidExterno).toBeGreaterThan(0);expect(o.metricas[0].pausou).toBe(true);conferir(o);expect(await foto()).toEqual(depoisMutacao);
}
beforeEach(async()=>{vi.restoreAllMocks();fetchGuard=vi.spyOn(globalThis,"fetch").mockImplementation(async()=>{throw Error("Bloqueio queryowner372: envio inesperado.");});await truncarBanco();gc=await criarUsuario([Papel.GERENTE_COMERCIAL],"GC fictício");ven=await criarUsuario([Papel.VENDEDOR],"VEN próprio");equipe=await criarUsuario([Papel.VENDEDOR],"VEN equipe");misto=await criarUsuario([Papel.VENDEDOR,Papel.GERENTE_COMERCIAL],"VEN GC próprio");equipeMisto=await criarUsuario([Papel.VENDEDOR],"VEN equipe mista");fora=await criarUsuario([Papel.VENDEDOR],"VEN fora");admin=await criarUsuario([Papel.ADMINISTRADOR],"Admin fictício");vazio=await criarUsuario([Papel.GERENTE_COMERCIAL],"GC sem equipe");inativo=await criarUsuario([Papel.VENDEDOR],"VEN inativo");await prisma.usuario.updateMany({where:{id:{in:[ven.id,equipe.id]}},data:{gerenteComercialId:gc.id}});await prisma.usuario.update({where:{id:equipeMisto.id},data:{gerenteComercialId:misto.id}});await prisma.usuario.update({where:{id:inativo.id},data:{ativo:false}});sessao.id=ven.id;});
afterEach(()=>{try{expect(fetchGuard).not.toHaveBeenCalled();}finally{vi.restoreAllMocks();}});
afterAll(()=>prisma.$disconnect());
it("matriz real VENself/GCteam/misto self+team/Admin/GC vazio retorna só id e nome sem writes",async()=>{
 expect(await prisma.oportunidade.count()).toBe(0);expect((await prisma.usuario.findUniqueOrThrow({where:{id:gc.id}})).papeis).toEqual([Papel.GERENTE_COMERCIAL]);expect((await prisma.usuario.findUniqueOrThrow({where:{id:misto.id}})).papeis).toEqual([Papel.VENDEDOR,Papel.GERENTE_COMERCIAL]);const antes=await foto(),o=observar();
 try{for(const[ator,ids]of[[ven,[ven.id]],[gc,[ven.id,equipe.id]],[misto,[misto.id,equipeMisto.id]],[admin,[ven.id,equipe.id,misto.id,equipeMisto.id,fora.id]],[vazio,[]]]as const){sessao.id=ator.id;const r=await listarVendedoresNovaConversa();expect(r.ok,JSON.stringify(r)).toBe(true);if(!r.ok||!r.dado)throw Error("Canário: sem DTO de opções");expect(r.dado.vendedores.map(v=>v.id).sort()).toEqual([...ids].sort());for(const v of r.dado.vendedores)expect(Object.keys(v).sort()).toEqual(["id","nome"]);expect(r.dado.vendedores.some(v=>v.id===inativo.id||v.id===gc.id||v.id===admin.id)).toBe(false);}}
 finally{o.parar();}expect(o.metricas).toHaveLength(5);conferir(o);expect(await foto()).toEqual(antes);
});
it("ator ativo/papéis/permissões revogados após findMany recusam na foto SQL real",async()=>{
 for(const campo of["ativo","papeis","permissoes"]as const){await prisma.usuario.update({where:{id:gc.id},data:{ativo:true,papeis:[Papel.GERENTE_COMERCIAL],permissoes:[]}});sessao.id=gc.id;await corrida(tx=>tx.usuario.update({where:{id:gc.id},data:campo==="ativo"?{ativo:false}:campo==="papeis"?{papeis:[Papel.FINANCEIRO]}:{permissoes:["revogacao-ficticia-372"]}}),{ok:false,erro:campo==="ativo"?"Não autenticado.":mensagem});}
});
it("candidato ativo/VEN/equipe revogados após findMany recusam sem lista obsoleta",async()=>{
 for(const campo of["ativo","papeis","gerente"]as const){await prisma.usuario.update({where:{id:equipe.id},data:{ativo:true,papeis:[Papel.VENDEDOR],gerenteComercialId:gc.id}});sessao.id=gc.id;await corrida(tx=>tx.usuario.update({where:{id:equipe.id},data:campo==="ativo"?{ativo:false}:campo==="papeis"?{papeis:[Papel.ADMINISTRADOR]}:{gerenteComercialId:fora.id}}),{ok:false,erro:mensagem});}
});
it("controle positivo lê nome fresco na mesma foto sem substituir por nome anterior",async()=>{
 sessao.id=gc.id;const nome="VEN equipe renomeado";await corrida(tx=>tx.usuario.update({where:{id:equipe.id},data:{nome}}),{ok:true,dado:{vendedores:[{id:equipe.id,nome},{id:ven.id,nome:ven.nome}].sort((a,b)=>a.nome.localeCompare(b.nome))}});
});