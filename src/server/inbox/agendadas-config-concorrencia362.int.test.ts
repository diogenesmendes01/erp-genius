import {afterAll,beforeEach,expect,it,vi} from "vitest";
import {PrismaClient,type Prisma} from "@prisma/client";
import {Client} from "pg";
import {mkdtemp,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {prisma} from "@/lib/prisma";
import {truncarBanco} from "@/test/integracao";
import {cenarioCadastroPessoa} from "@/test/inbox-cadastro-pessoa";
import {diaUtilAs} from "@/test/janela-envio";
import {atendimentoVisivel} from "@/server/whatsapp/atendimentos";
import {executarAgendadaInbox,type BancoAgendadaInbox,type ComandoAgendadaInbox} from "./agendadas-operacao-inbox";
// Autoria test-only C2; não executado antes de lease ROOT. SQL/ACL são reais.
beforeEach(()=>truncarBanco());
afterAll(()=>prisma.$disconnect());
async function fixture(){
 const c=await cenarioCadastroPessoa();
 await prisma.oportunidade.update({where:{id:c.op.id},data:{telefoneE164:c.contato.telefoneE164}});
 await prisma.configIA.upsert({where:{id:"ia"},create:{id:"ia"},update:{}});
 await prisma.atendimentoWhatsApp.update({where:{id:c.atendimento.id},data:{responsavelId:c.dono.id,iaPausadaEm:new Date()}});
 const numeroB=await prisma.numeroWhatsApp.create({data:{telefoneE164:c.numero.telefoneE164+"9",rotulo:"LinhaB fictícia362",driver:"MOTOR",finalidade:"VENDAS",donoId:c.dono.id}});
 const conversa=await prisma.conversaWhatsApp.create({data:{numeroId:numeroB.id,contatoId:c.contato.id}});
 const b=await prisma.atendimentoWhatsApp.create({data:{conversaId:conversa.id,contextoChave:"COMERCIAL::362:config-b",finalidade:"COMERCIAL",leadId:c.op.id,responsavelId:c.dono.id,iaPausadaEm:new Date()}});
 // Mesmo telefone canônico do Lead; duas linhas próprias/conversas/pais distintos.
 expect(c.atendimento.id).not.toBe(b.id);expect(c.conversa.id).not.toBe(conversa.id);
 expect(await atendimentoVisivel(c.dono,c.atendimento.id,true,prisma)).not.toBeNull();
 expect(await atendimentoVisivel(c.dono,b.id,true,prisma)).not.toBeNull();
 expect(await prisma.configIA.findUnique({where:{id:"ia"}})).not.toBeNull();
 return {...c,b};
}
function comando(id:string,chave:string):ComandoAgendadaInbox{return {tipo:"CRIAR",atendimentoId:id,texto:"Fictício mediçãoConfig362",agendadaPara:diaUtilAs(10,"America/Costa_Rica").toISOString(),chaveIdempotencia:chave};}
function flags(sql:string){return {select:/\bSELECT\b/i.test(sql),insert:/\bINSERT\s+INTO\b/i.test(sql),update:/\bUPDATE\b/i.test(sql),config:sql.includes('"ConfigIA"'),pai:sql.includes('"AtendimentoWhatsApp"'),share:sql.includes("FOR SHARE"),forUpdate:sql.includes("FOR UPDATE"),advisory:sql.includes("pg_advisory_xact_lock")};}
async function pg(){const c=new Client({connectionString:process.env.DATABASE_URL});try{await c.connect();return c;}catch(e){try{await c.end();}catch(cleanup){throw new AggregateError([e,cleanup],"Conexão/cleanup C2");}throw e;}}
type Resultado={valor:{id:string}}|{erro:unknown};
function worker(autor:string,c:ComandoAgendadaInbox){
 const url=new URL(process.env.DATABASE_URL!);url.searchParams.set("connection_limit","1");
 const db=new PrismaClient({datasources:{db:{url:url.toString()}},log:[{emit:"event",level:"query"}]});
 const inicio=Date.now(),queries:{ms:number;sql:ReturnType<typeof flags>}[]=[];
 db.$on("query",e=>queries.push({ms:Date.now()-inicio,sql:flags(e.query)}));
 let pidResolve!:(pid:number)=>void;const pid=new Promise<number>(r=>pidResolve=r);let acabou=false;
 const banco={$transaction:<T>(fn:(tx:Prisma.TransactionClient)=>Promise<T>)=>db.$transaction(async tx=>{const [p]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() pid`;if(!p)throw new Error("PID ausente");pidResolve(p.pid);return fn(tx);})} as BancoAgendadaInbox;
 const resultado:Promise<Resultado>=executarAgendadaInbox(banco,autor,c).then(valor=>({valor}),erro=>({erro})).finally(()=>{acabou=true;});
 return {db,pid,resultado,queries,acabou:()=>acabou};
}
type Worker=ReturnType<typeof worker>;
async function obterPid(w:Worker){let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([w.pid,w.resultado.then(()=>{throw new Error("Worker encerrou antes do PID");}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("PID não iniciou em2s")),2000);})]);}finally{if(timer)clearTimeout(timer);}}
type Linha={pid:number;state:string;wait_event_type:string|null;wait_event:string|null;query:string;bloqueadores:number[]};
async function ler(o:Client,pids:number[]){await o.query("SELECT pg_stat_clear_snapshot()");const r=await o.query<Linha>('SELECT pid,state,wait_event_type,wait_event,query,pg_blocking_pids(pid) bloqueadores FROM pg_stat_activity WHERE datname=current_database() AND pid=ANY($1::int[])',[pids]);return r.rows;}
async function esperarPai(o:Client,w:Worker,pid:number,holder:number){const samples:unknown[]=[];const limite=Date.now()+2000;while(Date.now()<limite){if(w.acabou())throw new Error("WorkerA encerrou antes do lock pai");const [r]=await ler(o,[pid]);samples.push(r?{pid:r.pid,state:r.state,wait:r.wait_event,bloqueadores:r.bloqueadores,sql:flags(r.query)}:null);if(r?.state==="active"&&r.wait_event_type==="Lock"&&r.bloqueadores.includes(holder)&&flags(r.query).pai&&flags(r.query).share)return samples;await new Promise(r=>setTimeout(r,20));}throw new Error("PaiA não observado em2s");}
async function fotoB(id:string){return {intencoes:await prisma.intencaoMensagem.findMany({where:{atendimentoId:id}}),eventos:await prisma.evento.findMany({where:{agregadoId:id}})};}
async function executar(ack:boolean){
 const c=await fixture();const cmdB=comando(c.b.id,"config-b-362");const recibo=ack?await executarAgendadaInbox(prisma,c.dono.id,cmdB):null;const antes=await fotoB(c.b.id);
 const fetch=vi.spyOn(globalThis,"fetch").mockImplementation(()=>{throw new Error("Integração externa proibida C2");});
 let h:Client|undefined,o:Client|undefined,a:Worker|undefined,b:Worker|undefined,primario:unknown;
 const evidence:Record<string,unknown>={ack};
 try{
  h=await pg();o=await pg();await h.query("BEGIN");await h.query('SELECT id FROM "AtendimentoWhatsApp" WHERE id=$1 FOR UPDATE',[c.atendimento.id]);
  const hp=(await h.query<{pid:number}>("SELECT pg_backend_pid() pid")).rows[0]!.pid,op=(await o.query<{pid:number}>("SELECT pg_backend_pid() pid")).rows[0]!.pid;
  a=worker(c.dono.id,comando(c.atendimento.id,"config-a-362"));const ap=await obterPid(a);evidence.paiA=await esperarPai(o,a,ap,hp);
  b=worker(c.dono.id,cmdB);const bp=await obterPid(b);expect(new Set([hp,op,ap,bp]).size).toBe(4);evidence.pids={holder:hp,observer:op,a:ap,b:bp};
  const limite=Date.now()+2000,samples:unknown[]=[];let convoy=false;
  while(!b.acabou()&&Date.now()<limite){const rows=await ler(o,[ap,bp]);samples.push(rows.map(r=>({pid:r.pid,state:r.state,waitType:r.wait_event_type,wait:r.wait_event,bloqueadores:r.bloqueadores,sql:flags(r.query)})));const rb=rows.find(r=>r.pid===bp);if(rb?.wait_event_type==="Lock"&&rb.bloqueadores.includes(ap)&&flags(rb.query).config){convoy=true;break;}await new Promise(r=>setTimeout(r,20));}
  const concluiuAntes=b.acabou();evidence.samples=samples;evidence.convoyConfig=convoy;evidence.bConcluiuAntesDeLiberarA=concluiuAntes;
  // Libera imediatamente após a observação; asserções causais só depois de ambos terminarem.
  await h.query("ROLLBACK");const [ra,rb]=await Promise.all([a.resultado,b.resultado]);evidence.a="valor" in ra?{sucesso:true}:{sucesso:false,code:(ra.erro as {code?:string})?.code??null};evidence.b="valor" in rb?{sucesso:true}:{sucesso:false,code:(rb.erro as {code?:string})?.code??null};evidence.queriesA=a.queries;evidence.queriesB=b.queries;
  expect(ra).toHaveProperty("valor.id");expect(rb).toHaveProperty("valor.id");
  if(!concluiuAntes&&!convoy)throw new Error("Medição inconclusiva: B não concluiu e não foi provado lock ConfigIA");
  expect(concluiuAntes,`Convoy ConfigIA comprovado=${convoy}; B independente deve terminar antes de liberarA`).toBe(true);
  if(ack){expect(rb).toEqual({valor:recibo});expect(await fotoB(c.b.id)).toEqual(antes);expect(b.queries.some(q=>q.sql.config&&(q.sql.insert||q.sql.update))).toBe(false);}
  else{expect(await prisma.intencaoMensagem.count({where:{atendimentoId:c.b.id}})).toBe(1);expect(await prisma.evento.count({where:{agregadoId:c.b.id,tipo:"MensagemAgendada"}})).toBe(1);}
  expect(fetch).not.toHaveBeenCalled();
 }catch(erro){primario=erro;throw erro;}finally{
  const erros:unknown[]=[];if(h)try{await h.query("ROLLBACK");}catch(e){erros.push(e);}
  const results=await Promise.allSettled([...(a?[a.resultado]:[]),...(b?[b.resultado]:[])]);erros.push(...results.flatMap(r=>r.status==="rejected"?[r.reason]:[]));
  const close=await Promise.allSettled([...(h?[h.end()]:[]),...(o?[o.end()]:[]),...(a?[a.db.$disconnect()]:[]),...(b?[b.db.$disconnect()]:[])]);erros.push(...close.flatMap(r=>r.status==="rejected"?[r.reason]:[]));
  fetch.mockRestore();try{const dir=await mkdtemp(join(tmpdir(),"inbox362-config-"));const path=join(dir,"curated.json");await writeFile(path,JSON.stringify({...evidence,cleanup:close.map(r=>r.status)},null,2));console.info("Medição curada Config362:",path);}catch(e){erros.push(e);}
  if(erros.length)throw new AggregateError([...(primario?[primario]:[]),...erros],"Erro e/ou cleanup Config362");
 }
}
it("SQL nova mutação em pai independente conclui enquanto A espera depois de Configupsert",()=>executar(false));
it("SQL ACK confirmado não visita ConfigDML enquanto novaA espera no próprio pai",()=>executar(true));