import type { Prisma } from "@prisma/client";
import { Client } from "pg";
import { mkdtemp,writeFile } from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {prisma} from "@/lib/prisma";
import {ErroPermissao,ErroRegra} from "@/server/_shared/sessao";
export type Resultado355<T>={ok:true;valor:T}|{ok:false;erro:unknown};
export type Diagnostico355={inicio:number;worker?:number;holder?:number;observer?:number;timeline:{ms:number;fase:string}[];samples:Record<string,unknown>[];ending?:Record<string,unknown>;cleanup?:string[]};
export function resumoErro355(e:unknown){const r=e as {code?:unknown;meta?:{code?:unknown}};return {dominio:e instanceof ErroRegra||e instanceof ErroPermissao,classe:e instanceof ErroRegra?"ErroRegra":e instanceof ErroPermissao?"ErroPermissao":"infra",code:typeof r?.code==="string"?r.code:null,sqlState:typeof r?.meta?.code==="string"?r.meta.code:null};}
export async function conectar355(){const pg=new Client({connectionString:process.env.DATABASE_URL});try{await pg.connect();return pg;}catch(e){try{await pg.end();}catch(cleanup){throw new AggregateError([e,cleanup],"Conexão e cleanup355 falharam");}throw e;}}
export async function fechar355(pg:Client){let erro:unknown;try{await pg.query("ROLLBACK");}catch(e){erro=e;}try{await pg.end();}catch(e){if(erro)throw new AggregateError([erro,e],"Cleanup355 falhou");throw e;}if(erro)throw erro;}
export async function holder355(sql:string,id:string){const pg=await conectar355();try{await pg.query("BEGIN");await pg.query(sql,[id]);const r=await pg.query<{pid:number}>("SELECT pg_backend_pid() pid");return {pg,pid:r.rows[0].pid};}catch(e){try{await fechar355(pg);}catch(cleanup){throw new AggregateError([e,cleanup],"Holder355 falhou");}throw e;}}
export type Holder355=Awaited<ReturnType<typeof holder355>>;
function fase(d:Diagnostico355,f:string){d.timeline.push({ms:Date.now()-d.inicio,fase:f});if(d.timeline.length>100)d.timeline.shift();}
export function flags355(sql:string){return {select:/\bSELECT\b/i.test(sql),update:/\bUPDATE\b/i.test(sql),insert:/\bINSERT\b/i.test(sql),pai:sql.includes('"AtendimentoWhatsApp"'),intencao:sql.includes('"IntencaoMensagem"'),acao:sql.includes('"AcaoAgenteIA"'),noKey:sql.includes("FOR NO KEY UPDATE"),forUpdate:/FOR UPDATE\b/.test(sql),share:/FOR SHARE\b/.test(sql)};}
export function iniciar355<T>(fn:(tx:Prisma.TransactionClient)=>Promise<T>,aposLerCandidatas?:()=>Promise<void>){
 let sinal!:(pid:number)=>void;const pronto=new Promise<number>(r=>sinal=r);let terminou=false;
 const diag:Diagnostico355={inicio:Date.now(),timeline:[],samples:[]};
 const resultado:Promise<Resultado355<T>>=prisma.$transaction(async tx=>{
  const [r]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() pid`;diag.worker=r.pid;sinal(r.pid);fase(diag,"worker.pid");
  const proxy=new Proxy(tx,{get(target,key,receiver){const value=Reflect.get(target,key,receiver);
   if(key==="$queryRaw"&&typeof value==="function")return async(...args:unknown[])=>{const q=args[0];const sql=Array.isArray(q)?q.join("?"):((q as {strings?:string[]})?.strings??[]).join("?");const f=flags355(sql);const label=f.pai&&f.noKey?"pai.noKey":f.pai&&f.forUpdate?"pai.update":f.intencao&&f.forUpdate?"intencao.update":f.acao&&f.forUpdate?"acao.update":"raw.other";fase(diag,"before."+label);const r=await Reflect.apply(value,target,args);fase(diag,"after."+label);return r;};
   if(key==="intencaoMensagem"&&value&&typeof value==="object")return new Proxy(value,{get(delegate,method){const f=Reflect.get(delegate,method);if(typeof f==="function"&&method==="findMany")return async(...args:unknown[])=>{const r=await Reflect.apply(f,delegate,args);fase(diag,"after.intencao.findMany");if(aposLerCandidatas)await aposLerCandidatas();return r;};return typeof f==="function"?f.bind(delegate):f;}});
   return typeof value==="function"?value.bind(target):value;
  }});return fn(proxy);
 }).then(valor=>{diag.ending={ok:true};return {ok:true as const,valor};},(erro:unknown)=>{diag.ending={ok:false,...resumoErro355(erro)};return {ok:false as const,erro};}).finally(()=>{terminou=true;fase(diag,"worker.ended");});
 return {pronto,resultado,diag,terminou:()=>terminou};
}
export type Operacao355=ReturnType<typeof iniciar355>;
export async function pid355(op:Operacao355){let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([op.pronto,op.resultado.then(()=>{throw Error("Worker355 encerrou sem PID");}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error("PID355 não chegou em 2s")),2000);})]);}finally{if(timer)clearTimeout(timer);}}
export async function esperarLock355(observer:Client,op:Operacao355,holderPid:number,tabela:"pai"|"intencao"){
 const worker=await pid355(op);const r=await observer.query<{pid:number}>("SELECT pg_backend_pid() pid");const obs=r.rows[0].pid;op.diag.holder=holderPid;op.diag.observer=obs;
 if(new Set([worker,holderPid,obs]).size!==3)throw Error("PIDs355 não independentes");
 const fim=Date.now()+2000;
 while(Date.now()<fim){if(op.terminou())throw Error("Worker355 terminou antes da barreira SQL");await observer.query("SELECT pg_stat_clear_snapshot()");const s=await observer.query<{state:string;wait_event_type:string;wait_event:string;query:string;blockers:number[]}>("SELECT state,wait_event_type,wait_event,query,pg_blocking_pids(pid) blockers FROM pg_stat_activity WHERE pid=$1 AND datname=current_database()",[worker]);const row=s.rows[0];if(row){const flags=flags355(row.query);op.diag.samples.push({ms:Date.now()-op.diag.inicio,worker,holder:holderPid,observer:obs,state:row.state,waitType:row.wait_event_type,waitEvent:row.wait_event,knownBlockers:row.blockers,sql:flags,fase:op.diag.timeline.at(-1)?.fase});if(op.diag.samples.length>30)op.diag.samples.shift();if(row.state==="active"&&row.wait_event_type==="Lock"&&row.blockers.includes(holderPid)&&flags.select&&(tabela==="pai"?flags.pai&&(flags.noKey||flags.forUpdate):flags.intencao&&flags.forUpdate))return;}
 await new Promise(r=>setTimeout(r,20));}throw Error("Barreira SQL355 não observada em 2s");
}
export async function artefato355(diag:Diagnostico355){const dir=await mkdtemp(join(tmpdir(),"inbox355-"));const file=join(dir,"diagnostico.json");await writeFile(file,JSON.stringify(diag,null,2));console.info("ARTEFATO355",file);return file;}
export async function limpar355(primario:unknown,holder:Holder355|undefined,observer:Client|undefined,ops:Operacao355[],liberar?:()=>void){liberar?.();const recursos=await Promise.allSettled([holder?fechar355(holder.pg):Promise.resolve(),observer?observer.end():Promise.resolve()]);const terminais=await Promise.allSettled(ops.map(o=>o.resultado));for(const op of ops){op.diag.cleanup=[...recursos,...terminais].map(r=>r.status);await artefato355(op.diag);}const erros=[...recursos,...terminais].flatMap(r=>r.status==="rejected"?[r.reason]:[]);if(erros.length)throw new AggregateError(primario?[primario,...erros]:erros,"Cleanup355 falhou");}
export function exigirDominio355(r:Resultado355<unknown>,tipo:"ErroPermissao"|"ErroRegra",mensagem:string){if(r.ok)throw Error("Era esperada recusa de domínio355");if(!(r.erro instanceof (tipo==="ErroRegra"?ErroRegra:ErroPermissao))||r.erro.message!==mensagem)throw new AggregateError([r.erro],"Recusa não corresponde ao domínio355 esperado");}