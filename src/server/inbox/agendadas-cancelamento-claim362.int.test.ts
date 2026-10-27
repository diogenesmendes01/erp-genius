import {afterAll,beforeEach,expect,it} from "vitest";
import {Papel,type Prisma} from "@prisma/client";
import {Client} from "pg";
import {mkdtemp,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {prisma} from "@/lib/prisma";
import {ErroRegra,type UsuarioSessao} from "@/server/_shared/sessao";
import {truncarBanco} from "@/test/integracao";
import {cenarioPerda328} from "@/test/inbox-perda";
import {atendimentoVisivel} from "@/server/whatsapp/atendimentos";
import {capacidadesCrm} from "@/server/crm/permissoes";
import {cancelarAgendadaInboxTx} from "./agendadas-cancelamento";
beforeEach(()=>truncarBanco());afterAll(()=>prisma.$disconnect());
async function fixture(){const c=await cenarioPerda328();expect(c.dono.papeis).toEqual([Papel.VENDEDOR]);expect(capacidadesCrm(c.dono.papeis).has("tarefas.ver")).toBe(true);expect(c.a.responsavelId).toBeNull();expect(await atendimentoVisivel(c.dono,c.a.id,false,prisma)).not.toBeNull();const intencao=await prisma.intencaoMensagem.create({data:{atendimentoId:c.a.id,numeroId:c.numero.id,contatoId:c.contato.id,autorId:c.dono.id,origem:"HUMANO",status:"PENDENTE",tipo:"TEXTO",corpoRenderizado:"Fictício cancel333 claim",agendadaPara:new Date(Date.now()+3_600_000)}});expect(intencao).toMatchObject({status:"PENDENTE",autorId:c.dono.id,atendimentoId:c.a.id});return {...c,intencao};}
async function conectar(){const pg=new Client({connectionString:process.env.DATABASE_URL});try{await pg.connect();return pg;}catch(erro){const fim=await Promise.allSettled([pg.end()]);const falhas=fim.flatMap(r=>r.status==="rejected"?[r.reason]:[]);if(falhas.length)throw new AggregateError([erro,...falhas],"Falha de conexão e cleanup");throw erro;}}
async function fechar(pg:Client){const erros:unknown[]=[];try{await pg.query("ROLLBACK");}catch(erro){erros.push(erro);}finally{try{await pg.end();}catch(erro){erros.push(erro);}}if(erros.length)throw new AggregateError(erros,"Falha no cleanup do holder");}
async function holder(sql:string,id:string){const pg=await conectar();try{await pg.query("BEGIN");await pg.query(sql,[id]);const r=await pg.query<{pid:number}>("SELECT pg_backend_pid() pid");return {pg,pid:r.rows[0]!.pid,sair:()=>fechar(pg)};}catch(erro){try{await fechar(pg);}catch(cleanup){throw new AggregateError([erro,cleanup],"Falha ao adquirir holder e limpar");}throw erro;}}
type Diagnostico={inicio:number;timeline:{ms:number;stage:string}[];samples:Record<string,unknown>[];worker?:number;holder?:number;observer?:number;holderClaimBeforeWorker?:boolean;holderEnding?:Record<string,unknown>;ending?:Record<string,unknown>;cleanup?:string[]};
function flagsSQL(sql:string){return {select:/\bSELECT\b/i.test(sql),insert:/\bINSERT\s+INTO\b/i.test(sql),update:/\bUPDATE\b/i.test(sql),noKeyUpdate:sql.includes("FOR NO KEY UPDATE"),forUpdate:/FOR UPDATE\b/.test(sql),forShare:/FOR SHARE\b/.test(sql),advisory:sql.includes("pg_advisory_xact_lock"),atendimento:sql.includes('"AtendimentoWhatsApp"'),intencao:sql.includes('"IntencaoMensagem"'),config:sql.includes('"ConfigIA"'),evento:sql.includes('"Evento"')};}
function resumoErro(erro:unknown){const e=erro as {code?:unknown;meta?:{code?:unknown}};const code=typeof e?.code==="string"&&/^(?:P\d{4}|[0-9A-Z]{5})$/.test(e.code)?e.code:null;const sqlState=typeof e?.meta?.code==="string"&&/^[0-9A-Z]{5}$/.test(e.meta.code)?e.meta.code:null;const dominio=erro instanceof ErroRegra;const mensagens=["A mensagem já foi despachada ou não pode mais ser cancelada.","Sua sessão não está mais ativa.","Mensagem não encontrada ou mudou de situação.","Assuma a conversa para alterar a mensagem agendada.","Atendimento não encontrado."];
 return {dominio,code,sqlState,mensagem:dominio&&mensagens.includes(erro.message)?erro.message:null,infra:!dominio};}
function fase(d:Diagnostico,stage:string){d.timeline.push({ms:Date.now()-d.inicio,stage});if(d.timeline.length>100)d.timeline.shift();}
function instrumentar(tx:Prisma.TransactionClient,d:Diagnostico){
 function chamar(fn:(...args:unknown[])=>unknown,dono:object,args:unknown[],stage:string){fase(d,"before."+stage);try{return Promise.resolve(Reflect.apply(fn,dono,args)).then(r=>{fase(d,"after."+stage);return r;},erro=>{fase(d,"error."+stage);throw erro;});}catch(erro){fase(d,"error."+stage);throw erro;}}
 return new Proxy(tx,{get(target,key,receiver){const value=Reflect.get(target,key,receiver);if(key==="$queryRaw"&&typeof value==="function")return (...args:unknown[])=>{const q=args[0];const sql=Array.isArray(q)?q.join("?"):((q as {strings?:string[]})?.strings??[]).join("?");const f=flagsSQL(sql);const label=f.noKeyUpdate?"raw.Atendimento.NO_KEY_UPDATE":f.forShare&&f.atendimento?"raw.Atendimento.SHARE":f.forUpdate&&f.intencao?"raw.Intencao.FOR_UPDATE":f.advisory?"raw.advisory":"raw.other";return chamar(value,target,args,label);};
 if(["configIA","intencaoMensagem","evento"].includes(String(key))&&value&&typeof value==="object")return new Proxy(value,{get(delegate,method){const fn=Reflect.get(delegate,method);if(typeof fn==="function"&&["upsert","findFirst","findUnique","create","updateMany"].includes(String(method)))return (...args:unknown[])=>chamar(fn,delegate,args,String(key)+"."+String(method));return typeof fn==="function"?fn.bind(delegate):fn;}});
 return typeof value==="function"?value.bind(target):value;}});
}
function iniciar(autor:UsuarioSessao,atendimentoId:string,intencaoId:string){
 let sinal!:(pid:number)=>void;const pronto=new Promise<number>(r=>sinal=r);let terminou=false;
 const diag:Diagnostico={inicio:Date.now(),timeline:[],samples:[]};
 const db={$transaction:async<T>(fn:(tx:Prisma.TransactionClient)=>Promise<T>)=>prisma.$transaction(async tx=>{const [linha]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() pid`;diag.worker=linha!.pid;fase(diag,"worker.pid");sinal(linha!.pid);return fn(instrumentar(tx,diag));})} as unknown as typeof prisma;
 const resultado=cancelarAgendadaInboxTx(autor,atendimentoId,intencaoId,db).then(valor=>{diag.ending={sucesso:true};return {valor};},(erro:unknown)=>{diag.ending={sucesso:false,...resumoErro(erro)};return {erro};}).finally(()=>{terminou=true;fase(diag,"worker.ended");});
 return {pronto,resultado,diag,terminou:()=>terminou};
}
type Operacao=ReturnType<typeof iniciar>;
type Holder=Awaited<ReturnType<typeof holder>>;
async function workerPid(op:Operacao){let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([op.pronto,op.resultado.then(()=>{throw new Error("Worker encerrou sem alcançar fase de PID");}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("Worker não iniciou em 2s")),2000);})]);}finally{if(timer)clearTimeout(timer);}}
async function esperar(observer:Client,h:Holder,op:Operacao,tabela:string,operacao:"lock"|"insert"|"advisory"="lock"){
 const worker=await workerPid(op);const oid=await observer.query<{pid:number}>("SELECT pg_backend_pid() pid");const observerPid=oid.rows[0]!.pid;
 op.diag.holder=h.pid;op.diag.observer=observerPid;
 expect(worker).not.toBe(h.pid);expect(worker).not.toBe(observerPid);expect(h.pid).not.toBe(observerPid);
 const limite=Date.now()+2000;
 while(Date.now()<limite){
  if(op.terminou())throw new Error("Worker terminou antes da espera SQL instrumental");
  await observer.query("SELECT pg_stat_clear_snapshot()");
  const r=await observer.query<{pid:number;state:string;wait_event_type:string;wait_event:string;query:string;bloqueadores:number[]}>("SELECT pid,state,wait_event_type,wait_event,query,pg_blocking_pids(pid) bloqueadores FROM pg_stat_activity WHERE pid=$1 AND datname=current_database()",[worker]);
  const row=r.rows[0];
  op.diag.samples.push({ms:Date.now()-op.diag.inicio,pid:row?.pid??worker,state:row?.state??null,waitType:row?.wait_event_type??null,waitEvent:row?.wait_event??null,knownBlockers:row?.bloqueadores??[],sql:flagsSQL(row?.query??""),stage:op.diag.timeline.at(-1)?.stage??null,terminou:op.terminou()});if(op.diag.samples.length>30)op.diag.samples.shift();
  const sqlEsperado=operacao==="lock"?row?.query.includes("SELECT")&&row.query.includes("FOR UPDATE"):operacao==="insert"?row?.query.includes("INSERT INTO"):row?.query.includes("SELECT")&&row.query.includes("pg_advisory_xact_lock");
  const eventoEsperado=operacao==="advisory"?row?.wait_event==="advisory":["transactionid","tuple"].includes(row?.wait_event??"");
  if(row?.state==="active"&&row.wait_event_type==="Lock"&&eventoEsperado&&sqlEsperado&&row.query.includes(tabela)&&row.bloqueadores.includes(h.pid))return;
  await new Promise(r=>setTimeout(r,20));
 }
 throw new Error("Worker selecionado não atingiu o lock esperado em 2s; samples curados="+JSON.stringify(op.diag.samples.slice(-5)));
}
function exigirRecusa(r:Awaited<Operacao["resultado"]>,mensagem:RegExp){expect(r).toHaveProperty("erro");if(!("erro" in r))throw new Error("Operação foi aceita");expect((r.erro as {code?:string})?.code).not.toBe("P2028");expect(r.erro instanceof ErroRegra,JSON.stringify(resumoErro(r.erro))).toBe(true);expect((r.erro as Error).message).toMatch(mensagem);}
async function limpar(primario:unknown,h?:Holder,observer?:Client,op?:Operacao){
 const rs=await Promise.allSettled([...(h?[h.sair()]:[]),...(observer?[observer.end()]:[])]);
 const erros=rs.flatMap(r=>r.status==="rejected"?[r.reason]:[]);
 if(op){const r=await Promise.allSettled([op.resultado]);erros.push(...r.flatMap(x=>x.status==="rejected"?[x.reason]:[]));op.diag.cleanup=rs.map(x=>x.status);fase(op.diag,"cleanup.finished");
  try{const dir=await mkdtemp(join(tmpdir(),"inbox333-claim-"));const path=join(dir,"curated.json");await writeFile(path,JSON.stringify({worker:op.diag.worker,holder:op.diag.holder??h?.pid,observer:op.diag.observer,timeline:op.diag.timeline,samples:op.diag.samples,holderClaimBeforeWorker:op.diag.holderClaimBeforeWorker??false,terminou:op.terminou(),ending:op.diag.ending,holderEnding:op.diag.holderEnding,cleanup:op.diag.cleanup,primary:primario?resumoErro(primario):null},null,2));console.info("Evidência curada cancel333:",path);}catch(erro){erros.push(erro);}
 }
 if(erros.length)throw new AggregateError([...(primario?[primario]:[]),...erros],"Erro primário e/ou cleanup SQL");
}

async function grafoClaim(observer:Client,h:Holder,op:Operacao,holderTerminou:()=>boolean){
 const worker=await workerPid(op);const limite=Date.now()+500;
 do {await observer.query("SELECT pg_stat_clear_snapshot()");const r=await observer.query<{pid:number;state:string;wait_event_type:string;wait_event:string;query:string;bloqueadores:number[]}>("SELECT pid,state,wait_event_type,wait_event,query,pg_blocking_pids(pid) bloqueadores FROM pg_stat_activity WHERE pid=ANY($1::int[]) AND datname=current_database()",[[worker,h.pid]]);
  for(const row of r.rows)op.diag.samples.push({ms:Date.now()-op.diag.inicio,pid:row.pid,role:row.pid===worker?"worker":"holder",state:row.state,waitType:row.wait_event_type,waitEvent:row.wait_event,knownBlockers:row.bloqueadores,sql:flagsSQL(row.query),stage:op.diag.timeline.at(-1)?.stage??null,terminou:op.terminou()});
  while(op.diag.samples.length>30)op.diag.samples.shift();
  if(holderTerminou()||r.rows.some(x=>x.pid===worker&&x.bloqueadores.includes(h.pid))&&r.rows.some(x=>x.pid===h.pid&&x.bloqueadores.includes(worker)))return;
  await new Promise(r=>setTimeout(r,20));
 }while(Date.now()<limite);
}

it("333 claim ENVIANDO confirma após cancel autorizado esperar intenção e cancel recusa domínio",async()=>{
 const c=await fixture();let h:Holder|undefined,observer:Client|undefined,op:Operacao|undefined,primario:unknown;let claim:Promise<{sucesso:true}|{erro:unknown}>|undefined;
 try{
  h=await holder('SELECT id FROM "IntencaoMensagem" WHERE id=$1 FOR UPDATE',c.intencao.id);observer=await conectar();
  op=iniciar(c.dono,c.a.id,c.intencao.id);await esperar(observer,h,op,'"IntencaoMensagem"');fase(op.diag,"holder.before.UPDATE_ENVIANDO.afterCancelIntencaoWait");
  let holderTerminou=false;claim=h.pg.query('UPDATE "IntencaoMensagem" SET status=\'ENVIANDO\' WHERE id=$1',[c.intencao.id]).then(()=>({sucesso:true as const}),(erro:unknown)=>({erro})).finally(()=>{holderTerminou=true;});
  await grafoClaim(observer,h,op,()=>holderTerminou);const hr=await claim;op.diag.holderEnding="erro" in hr?{sucesso:false,...resumoErro(hr.erro)}:{sucesso:true};if("erro" in hr)await h.pg.query("ROLLBACK");else await h.pg.query("COMMIT");const wr=await op.resultado;
  expect(op.diag.holderEnding,"claim deve confirmar sem infra/deadlock").toEqual({sucesso:true});
  exigirRecusa(wr,/^A mensagem já foi despachada ou não pode mais ser cancelada\.$/);
  expect((await prisma.intencaoMensagem.findUniqueOrThrow({where:{id:c.intencao.id}})).status).toBe("ENVIANDO");expect(await prisma.evento.count({where:{agregadoId:c.a.id,tipo:"MensagemAgendadaCancelada"}})).toBe(0);
 }catch(erro){primario=erro;throw erro;}finally{try{await limpar(primario,h,observer,op);}finally{if(claim)await claim;}}
});
