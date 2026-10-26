import {afterAll,beforeEach,expect,it,vi} from "vitest";
import {Client} from "pg";
import {Papel,type Prisma} from "@prisma/client";
import {writeFileSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {randomUUID} from "node:crypto";
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {prisma} from "@/lib/prisma";
import {truncarBanco,criarUsuario,configurarFusoDaEscola} from "@/test/integracao";
import {cenarioPerda328} from "@/test/inbox-perda";
import {ErroRegra} from "@/server/_shared/sessao";
import {dadosTarefaModal,preverNotificadosTarefaInbox} from "./tarefas-edicao";
import * as catalogo from "@/server/crm/tarefa-notificados-consulta";
import {rodarLembretesTarefas} from "@/server/crm/lembretes";
beforeEach(async()=>{vi.restoreAllMocks();await truncarBanco();});afterAll(()=>prisma.$disconnect());
function registro(caso:string){
 const arquivo=join(tmpdir(),`inbox-338-fresh-races-r30-${caso}-${randomUUID()}.json`);
 const dado:{caso:string;fase:string;workerPid:number|null;externoPid:number|null;fases:string[];causa?:unknown;resultadoPublico?:unknown;estado?:unknown;revogacao?:unknown}={caso,fase:"PREPARANDO",workerPid:null,externoPid:null,fases:[]};
 return {dado,preservar:()=>writeFileSync(arquivo,JSON.stringify(dado,null,2),"utf8")};
}
function causaSegura(e:unknown){const v=e as {name?:unknown;code?:unknown;meta?:{code?:unknown}};return {classe:typeof v?.name==="string"?v.name:null,dominio:e instanceof ErroRegra?e.message:null,codigo:typeof v?.code==="string"?v.code:null,sqlState:typeof v?.meta?.code==="string"?v.meta.code:null};}
async function revogar(c:Client,id:string,fases:string[],capturar:(dado:unknown)=>void){
 await c.query("BEGIN");try{const r=await c.query(`UPDATE "Usuario" SET papeis=ARRAY['ALUNO']::"Papel"[] WHERE id=$1`,[id]);expect(r.rowCount).toBe(1);await c.query("COMMIT");}catch(e){await c.query("ROLLBACK");throw e;}
 const r=await c.query<{papeis:string[]}>(`SELECT papeis::text[] AS papeis FROM "Usuario" WHERE id=$1`,[id]);capturar({papelRaw:r.rows[0]?.papeis??null,array:Array.isArray(r.rows[0]?.papeis),commitRetornou:true});expect(r.rows[0]?.papeis).toEqual(["ALUNO"]);fases.push("REVOGACAO_COMMIT_CONFIRMADA");
}
async function encerrar(c:Client,restaurar:()=>void,principal:unknown){
 const rr=await Promise.allSettled([Promise.resolve().then(restaurar),c.end()]);const falhas=rr.filter((r):r is PromiseRejectedResult=>r.status==="rejected").map(r=>r.reason);
 if(falhas.length)throw new AggregateError(principal?[principal,...falhas]:falhas,"Falha no cleanup da contraprova D10");
}
it("preview SQL recusa catálogo revogado após leitura real e antes do guard final",async()=>{
 const prova=registro("preview"),externo=new Client({connectionString:process.env.DATABASE_URL});let restaurar=()=>{},principal:unknown;
 try{
  await externo.connect();prova.dado.externoPid=(await externo.query<{pid:number}>("SELECT pg_backend_pid() pid")).rows[0]!.pid;
  const c=await cenarioPerda328(),colega=await criarUsuario([Papel.ADMINISTRADOR]);await configurarFusoDaEscola("UTC");
  const autor=await prisma.usuario.findUniqueOrThrow({where:{id:c.dono.id}}),d=await dadosTarefaModal(autor,c.a.id);
  const pedido={modo:"nova" as const,contextoEsperado:d.contextoEsperado};
  const canario=await preverNotificadosTarefaInbox(autor,c.a.id,pedido);expect(canario.candidatos.some(u=>u.id===colega.id)).toBe(true);
  const original=catalogo.listarCandidatosNotificadosTarefaD10;let mudou=false;
  const spy=vi.spyOn(catalogo,"listarCandidatosNotificadosTarefaD10").mockImplementation(async(...args)=>{
   const rows=await original(...args);
   if(!mudou){expect(rows.some(u=>u.id===colega.id)).toBe(true);prova.dado.workerPid=(await args[0].$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() pid`)[0]!.pid;expect(prova.dado.workerPid).not.toBe(prova.dado.externoPid);prova.dado.fases.push("CATALOGO_SQL_REAL_LIDO");mudou=true;await revogar(externo,colega.id,prova.dado.fases,d=>{prova.dado.revogacao=d;prova.preservar();});}
   else{prova.dado.fases.push("CATALOGO_SQL_POS_REVOGACAO");expect(rows.some(u=>u.id===colega.id)).toBe(false);}
   return rows;
  });restaurar=()=>spy.mockRestore();
  let causa:unknown;try{await preverNotificadosTarefaInbox(autor,c.a.id,pedido);}catch(e){causa=e;}
  prova.dado.causa=causaSegura(causa);prova.dado.estado={tarefas:await prisma.tarefa.count(),eventos:await prisma.evento.count()};prova.dado.fase="MEDIDO_ANTES_ASSERTS";prova.preservar();
  expect(mudou).toBe(true);expect(prova.dado.fases).toEqual(["CATALOGO_SQL_REAL_LIDO","REVOGACAO_COMMIT_CONFIRMADA","CATALOGO_SQL_POS_REVOGACAO"]);
  expect(causa).toBeInstanceOf(ErroRegra);expect(causa).toMatchObject({message:"A prévia mudou. Atualize os colegas disponíveis."});expect(causaSegura(causa)).toMatchObject({codigo:null,sqlState:null});expect(prova.dado.estado).toEqual({tarefas:0,eventos:0});prova.dado.fase="ASSERTS_PASSARAM";
 }catch(e){principal=e;prova.dado.fase="FALHOU";throw e;}finally{prova.preservar();await encerrar(externo,restaurar,principal);}
});
it("fanout SQL aborta claim e INSERT real quando destinatário perde autorização antes do guard final",async()=>{
 const prova=registro("fanout"),externo=new Client({connectionString:process.env.DATABASE_URL});let restaurar=()=>{},principal:unknown;
 try{
  await externo.connect();prova.dado.externoPid=(await externo.query<{pid:number}>("SELECT pg_backend_pid() pid")).rows[0]!.pid;
  const autor=await criarUsuario([Papel.VENDEDOR]),colega=await criarUsuario([Papel.ADMINISTRADOR]),agora=new Date("2026-10-25T15:00:00Z");
  const t=await prisma.tarefa.create({data:{titulo:"Race fanout fictícia338",tipo:"OUTRO",setor:"COMERCIAL",responsavelId:null,fusoOrigem:"UTC",dataCivil:"2026-10-25",inicioEm:agora,lembreteAntecedenciaMin:15,lembrarEm:new Date(agora.getTime()-900000),notificados:{create:{usuarioId:colega.id}}}});
  const canario=await catalogo.listarCandidatosNotificadosTarefaD10(prisma,autor,{responsavelId:null,setor:"COMERCIAL",gerenteDoResponsavelId:null});expect(canario.some(u=>u.id===colega.id)).toBe(true);
  let causaTx:unknown,criou=false,mudou=false;
  const original=prisma.$transaction.bind(prisma);
  const spy=vi.spyOn(prisma,"$transaction").mockImplementation(((fn:unknown,...opcoes:unknown[])=>{
   if(typeof fn!=="function")return Reflect.apply(original,prisma,[fn,...opcoes]);
   return Reflect.apply(original,prisma,[async(tx:Prisma.TransactionClient)=>{
    prova.dado.workerPid=(await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() pid`)[0]!.pid;expect(prova.dado.workerPid).not.toBe(prova.dado.externoPid);
    const porta=new Proxy(tx,{get(alvo,chave){if(chave==="notificacaoUsuario")return new Proxy(alvo.notificacaoUsuario,{get(delegate,op){const valor=Reflect.get(delegate,op);if(op==="create")return async(...args:unknown[])=>{const row=await Reflect.apply(valor,delegate,args);criou=true;prova.dado.fases.push("NOTIFICACAO_INSERT_SQL_REAL");if(!mudou){mudou=true;await revogar(externo,colega.id,prova.dado.fases,d=>{prova.dado.revogacao=d;prova.preservar();});}return row;};return typeof valor==="function"?valor.bind(delegate):valor;}});const valor=Reflect.get(alvo,chave);return typeof valor==="function"?valor.bind(alvo):valor;}});
    try{return await Reflect.apply(fn,undefined,[porta]);}catch(e){causaTx=e;prova.dado.fases.push("CAUSA_NO_LIMITE_TRANSACIONAL");throw e;}
   },...opcoes]);
  }) as typeof prisma.$transaction);restaurar=()=>spy.mockRestore();
  let resultado:Awaited<ReturnType<typeof rodarLembretesTarefas>>|undefined,erroPublico:unknown;try{resultado=await rodarLembretesTarefas(agora);}catch(e){erroPublico=e;}
  prova.dado.causa=causaSegura(causaTx);prova.dado.resultadoPublico=erroPublico?{rejeitou:true,causa:causaSegura(erroPublico)}:resultado;
  const final=await prisma.tarefa.findUniqueOrThrow({where:{id:t.id}});prova.dado.estado={status:final.status,claim:final.lembreteDisparadoEm?.toISOString()??null,avisos:await prisma.notificacaoUsuario.count({where:{refId:t.id}}),eventos:await prisma.evento.count({where:{tipo:"LembreteDisparado",agregadoId:t.id}}),papel:(await prisma.usuario.findUniqueOrThrow({where:{id:colega.id}})).papeis};prova.dado.fase="MEDIDO_ANTES_ASSERTS";prova.preservar();
  expect(criou).toBe(true);expect(mudou).toBe(true);expect(prova.dado.fases).toEqual(["NOTIFICACAO_INSERT_SQL_REAL","REVOGACAO_COMMIT_CONFIRMADA","CAUSA_NO_LIMITE_TRANSACIONAL"]);
  expect(causaTx).toBeInstanceOf(ErroRegra);expect(causaTx).toMatchObject({message:"O lembrete mudou durante a entrega. Aguarde o próximo ciclo."});expect(causaSegura(causaTx)).toMatchObject({codigo:null,sqlState:null});
  // Mantém o contrato externo: rejeição canônica ou contador0 se a fronteira o capturar.
  if(erroPublico)expect(erroPublico).toBe(causaTx);else expect(resultado).toEqual({notificadas:0});
  expect(prova.dado.estado).toEqual({status:"ABERTA",claim:null,avisos:0,eventos:0,papel:["ALUNO"]});prova.dado.fase="ASSERTS_PASSARAM";
 }catch(e){principal=e;prova.dado.fase="FALHOU";throw e;}finally{prova.preservar();await encerrar(externo,restaurar,principal);}
});