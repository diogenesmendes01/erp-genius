import {afterAll,beforeEach,expect,it} from "vitest";
import {PrismaClient,type Prisma} from "@prisma/client";
import {ErroRegra} from "@/server/_shared/sessao";
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
import {lerAgendadasDoAtendimento} from "./agendadas-leitura";
beforeEach(()=>truncarBanco());
afterAll(()=>prisma.$disconnect());
async function fixture(){
 const c=await cenarioCadastroPessoa();
 await prisma.oportunidade.update({where:{id:c.op.id},data:{telefoneE164:c.contato.telefoneE164}});
 await prisma.configIA.upsert({where:{id:"ia"},create:{id:"ia"},update:{}});
 await prisma.atendimentoWhatsApp.update({where:{id:c.atendimento.id},data:{responsavelId:c.dono.id,iaPausadaEm:new Date()}});
 const a=await atendimentoVisivel(c.dono,c.atendimento.id,true,prisma);
 expect(a).not.toBeNull();expect(a?.responsavelId).toBe(c.dono.id);expect(a?.contato.telefoneE164).toBe(c.contato.telefoneE164);
 return c;
}
function criar(c:Awaited<ReturnType<typeof fixture>>,chave="native-criar-362"):Extract<ComandoAgendadaInbox,{tipo:"CRIAR"}>{return {tipo:"CRIAR",atendimentoId:c.atendimento.id,texto:"Mensagem fictícia nativa362",agendadaPara:diaUtilAs(10,"America/Costa_Rica").toISOString(),chaveIdempotencia:chave};}
async function contar(c:Awaited<ReturnType<typeof fixture>>){return prisma.evento.count({where:{agregadoTipo:"AtendimentoWhatsApp",agregadoId:c.atendimento.id,tipo:{in:["MensagemAgendada","MensagemReagendada"]}}});}
async function conectar(){const pg=new Client({connectionString:process.env.DATABASE_URL});try{await pg.connect();return pg;}catch(erro){const fim=await Promise.allSettled([pg.end()]);const falhas=fim.flatMap(r=>r.status==="rejected"?[r.reason]:[]);if(falhas.length)throw new AggregateError([erro,...falhas],"Falha de conexão e cleanup");throw erro;}}
async function fechar(pg:Client){const erros:unknown[]=[];try{await pg.query("ROLLBACK");}catch(erro){erros.push(erro);}finally{try{await pg.end();}catch(erro){erros.push(erro);}}if(erros.length)throw new AggregateError(erros,"Falha no cleanup do holder");}
async function holder(sql:string,id:string){const pg=await conectar();try{await pg.query("BEGIN");await pg.query(sql,[id]);const r=await pg.query<{pid:number}>("SELECT pg_backend_pid() pid");return {pg,pid:r.rows[0]!.pid,sair:()=>fechar(pg)};}catch(erro){try{await fechar(pg);}catch(cleanup){throw new AggregateError([erro,cleanup],"Falha ao adquirir holder e limpar");}throw erro;}}
type Diagnostico={inicio:number;timeline:{ms:number;stage:string}[];samples:Record<string,unknown>[];worker?:number;holder?:number;observer?:number;holderClaimBeforeWorker?:boolean;holderEnding?:Record<string,unknown>;ending?:Record<string,unknown>;cleanup?:string[]};
function flagsSQL(sql:string){return {select:/\bSELECT\b/i.test(sql),insert:/\bINSERT\s+INTO\b/i.test(sql),update:/\bUPDATE\b/i.test(sql),noKeyUpdate:sql.includes("FOR NO KEY UPDATE"),forUpdate:/FOR UPDATE\b/.test(sql),forShare:/FOR SHARE\b/.test(sql),advisory:sql.includes("pg_advisory_xact_lock"),atendimento:sql.includes('"AtendimentoWhatsApp"'),intencao:sql.includes('"IntencaoMensagem"'),config:sql.includes('"ConfigIA"'),evento:sql.includes('"Evento"')};}
function resumoErro(erro:unknown){const e=erro as {code?:unknown;meta?:{code?:unknown}};const code=typeof e?.code==="string"&&/^(?:P\d{4}|[0-9A-Z]{5})$/.test(e.code)?e.code:null;const sqlState=typeof e?.meta?.code==="string"&&/^[0-9A-Z]{5}$/.test(e.meta.code)?e.meta.code:null;const dominio=erro instanceof ErroRegra;const mensagens=["Sua sessão não está mais ativa.","Mensagem não encontrada ou mudou de situação.","Assuma a conversa para alterar a mensagem agendada.","Atendimento não encontrado."];
 return {dominio,code,sqlState,mensagem:dominio&&mensagens.includes(erro.message)?erro.message:null,infra:!dominio};}
function fase(d:Diagnostico,stage:string){d.timeline.push({ms:Date.now()-d.inicio,stage});if(d.timeline.length>100)d.timeline.shift();}
function instrumentar(tx:Prisma.TransactionClient,d:Diagnostico){
 function chamar(fn:(...args:unknown[])=>unknown,dono:object,args:unknown[],stage:string){fase(d,"before."+stage);try{return Promise.resolve(Reflect.apply(fn,dono,args)).then(r=>{fase(d,"after."+stage);return r;},erro=>{fase(d,"error."+stage);throw erro;});}catch(erro){fase(d,"error."+stage);throw erro;}}
 return new Proxy(tx,{get(target,key,receiver){const value=Reflect.get(target,key,receiver);if(key==="$queryRaw"&&typeof value==="function")return (...args:unknown[])=>{const q=args[0];const sql=Array.isArray(q)?q.join("?"):((q as {strings?:string[]})?.strings??[]).join("?");const f=flagsSQL(sql);const label=f.noKeyUpdate?"raw.Atendimento.NO_KEY_UPDATE":f.forShare&&f.atendimento?"raw.Atendimento.SHARE":f.forUpdate&&f.intencao?"raw.Intencao.FOR_UPDATE":f.advisory?"raw.advisory":"raw.other";return chamar(value,target,args,label);};
 if(["configIA","intencaoMensagem","evento"].includes(String(key))&&value&&typeof value==="object")return new Proxy(value,{get(delegate,method){const fn=Reflect.get(delegate,method);if(typeof fn==="function"&&["upsert","findFirst","findUnique","create","updateMany"].includes(String(method)))return (...args:unknown[])=>chamar(fn,delegate,args,String(key)+"."+String(method));return typeof fn==="function"?fn.bind(delegate):fn;}});
 return typeof value==="function"?value.bind(target):value;}});
}
function iniciar(autorId:string,comando:ComandoAgendadaInbox){
 let sinal!:(pid:number)=>void;const pronto=new Promise<number>(r=>sinal=r);let terminou=false;
 const diag:Diagnostico={inicio:Date.now(),timeline:[],samples:[]};
 const db={$transaction:async<T>(fn:(tx:Prisma.TransactionClient)=>Promise<T>)=>prisma.$transaction(async tx=>{const [linha]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() pid`;diag.worker=linha!.pid;fase(diag,"worker.pid");sinal(linha!.pid);return fn(instrumentar(tx,diag));})} as unknown as BancoAgendadaInbox;
 const resultado=executarAgendadaInbox(db,autorId,comando).then(valor=>{diag.ending={sucesso:true};return {valor};},(erro:unknown)=>{diag.ending={sucesso:false,...resumoErro(erro)};return {erro};}).finally(()=>{terminou=true;fase(diag,"worker.ended");});
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
  try{const dir=await mkdtemp(join(tmpdir(),"inbox362-observer-"));const path=join(dir,"curated.json");await writeFile(path,JSON.stringify({worker:op.diag.worker,holder:op.diag.holder??h?.pid,observer:op.diag.observer,timeline:op.diag.timeline,samples:op.diag.samples,holderClaimBeforeWorker:op.diag.holderClaimBeforeWorker??false,terminou:op.terminou(),ending:op.diag.ending,holderEnding:op.diag.holderEnding,cleanup:op.diag.cleanup,primary:primario?resumoErro(primario):null},null,2));console.info("Evidência curada observer362:",path);}catch(erro){erros.push(erro);}
 }
 if(erros.length)throw new AggregateError([...(primario?[primario]:[]),...erros],"Erro primário e/ou cleanup SQL");
}
it("SQL cria, reagenda e torna elegível sem chamar provedor",async()=>{
 const c=await fixture();const nova=await executarAgendadaInbox(prisma,c.dono.id,criar(c));
 const antes=await prisma.intencaoMensagem.findUniqueOrThrow({where:{id:nova.id}});
 expect(antes).toMatchObject({atendimentoId:c.atendimento.id,numeroId:c.numero.id,contatoId:c.contato.id,origem:"HUMANO",autorId:c.dono.id,status:"PENDENTE"});
 const quando=diaUtilAs(11,"America/Costa_Rica");
 expect(await executarAgendadaInbox(prisma,c.dono.id,{tipo:"REAGENDAR",atendimentoId:c.atendimento.id,intencaoId:nova.id,agendadaPara:quando.toISOString()})).toEqual(nova);
 expect((await prisma.intencaoMensagem.findUniqueOrThrow({where:{id:nova.id}})).agendadaPara).toEqual(quando);
 const inicio=Date.now();expect(await executarAgendadaInbox(prisma,c.dono.id,{tipo:"ENVIAR_AGORA",atendimentoId:c.atendimento.id,intencaoId:nova.id})).toEqual(nova);
 const final=await prisma.intencaoMensagem.findUniqueOrThrow({where:{id:nova.id}});
 expect(final.status).toBe("PENDENTE");expect(final.agendadaPara!.getTime()).toBeGreaterThanOrEqual(inicio);expect(final.agendadaPara!.getTime()).toBeLessThanOrEqual(Date.now());expect(await contar(c)).toBe(3);
});
it("SQL leitor real lista DTO do fio e retira podeAlterar após perda de Assumir",async()=>{
 const c=await fixture();const nova=await executarAgendadaInbox(prisma,c.dono.id,criar(c));
 const lista=await lerAgendadasDoAtendimento(prisma,c.dono.id,c.atendimento.id);
 expect(lista).toHaveLength(1);expect(lista[0]).toMatchObject({id:nova.id,podeAlterar:true,autor:"voce"});
 expect(Object.keys(lista[0]!).sort()).toEqual(["id","texto","agendadaPara","status","tipo","temAnexo","autor","autorNome","podeAlterar"].sort());
 await prisma.atendimentoWhatsApp.update({where:{id:c.atendimento.id},data:{responsavelId:null}});
 expect(await lerAgendadasDoAtendimento(prisma,c.dono.id,c.atendimento.id)).toEqual([expect.objectContaining({id:nova.id,podeAlterar:false})]);
 expect(await lerAgendadasDoAtendimento(prisma,c.outro.id,c.atendimento.id)).toEqual([]);
});
it("SQL replay próprio preserva id/Evento e conflito de horário não grava",async()=>{
 const c=await fixture();const comando=criar(c);const primeira=await executarAgendadaInbox(prisma,c.dono.id,comando);
 expect(await executarAgendadaInbox(prisma,c.dono.id,comando)).toEqual(primeira);expect(await contar(c)).toBe(1);
 await expect(executarAgendadaInbox(prisma,c.dono.id,{...comando,agendadaPara:diaUtilAs(11,"America/Costa_Rica").toISOString()})).rejects.toThrow(/tentativa/);
 expect(await prisma.intencaoMensagem.count()).toBe(1);expect(await contar(c)).toBe(1);
});
it("SQL namespace por tipo permite chave CRIAR/REAGENDAR e conflita REAGENDAR/ENVIAR_AGORA",async()=>{
 const c=await fixture();const comando=criar(c);const nova=await executarAgendadaInbox(prisma,c.dono.id,comando);
 const reagendar={tipo:"REAGENDAR" as const,atendimentoId:c.atendimento.id,intencaoId:nova.id,agendadaPara:diaUtilAs(11,"America/Costa_Rica").toISOString(),chaveIdempotencia:comando.chaveIdempotencia};
 expect(await executarAgendadaInbox(prisma,c.dono.id,reagendar)).toEqual(nova);expect(await executarAgendadaInbox(prisma,c.dono.id,reagendar)).toEqual(nova);
 await expect(executarAgendadaInbox(prisma,c.dono.id,{tipo:"ENVIAR_AGORA",atendimentoId:c.atendimento.id,intencaoId:nova.id,chaveIdempotencia:comando.chaveIdempotencia})).rejects.toThrow(/tentativa/);
 expect(await contar(c)).toBe(2);
});
it("SQL concorrentes com a mesma chave confirmam somente uma criação",async()=>{
 const c=await fixture();const comando=criar(c);const [a,b]=await Promise.all([executarAgendadaInbox(prisma,c.dono.id,comando),executarAgendadaInbox(prisma,c.dono.id,comando)]);
 expect(a).toEqual(b);expect(await prisma.intencaoMensagem.count()).toBe(1);expect(await contar(c)).toBe(1);
});
it("SQL replay espera Intencao FOR UPDATE e recusa ator revogado durante espera",async()=>{
 const c=await fixture();const comando=criar(c);const nova=await executarAgendadaInbox(prisma,c.dono.id,comando);let h:Holder|undefined,observer:Client|undefined,op:Operacao|undefined,primario:unknown;
 try {h=await holder('SELECT id FROM "IntencaoMensagem" WHERE id=$1 FOR UPDATE',nova.id);observer=await conectar();op=iniciar(c.dono.id,comando);await esperar(observer,h,op,'"IntencaoMensagem"');await h.pg.query('UPDATE "Usuario" SET ativo=false WHERE id=$1',[c.dono.id]);await h.pg.query("COMMIT");exigirRecusa(await op.resultado,/sessão.*ativa/i);expect(await contar(c)).toBe(1);}
 catch(erro){primario=erro;throw erro;}finally {await limpar(primario,h,observer,op);}
});
it("SQL claim ENVIANDO vencedor é observado após espera e não sobrescrito",async()=>{
 const c=await fixture();const nova=await executarAgendadaInbox(prisma,c.dono.id,criar(c));let h:Holder|undefined,observer:Client|undefined,op:Operacao|undefined,primario:unknown;
 try {h=await holder('SELECT id FROM "IntencaoMensagem" WHERE id=$1 FOR UPDATE',nova.id);observer=await conectar();await h.pg.query('UPDATE "IntencaoMensagem" SET status=\'ENVIANDO\' WHERE id=$1',[nova.id]);op=iniciar(c.dono.id,{tipo:"REAGENDAR",atendimentoId:c.atendimento.id,intencaoId:nova.id,agendadaPara:diaUtilAs(11,"America/Costa_Rica").toISOString()});op.diag.holderClaimBeforeWorker=true;await esperar(observer,h,op,'"IntencaoMensagem"');await h.pg.query("COMMIT");exigirRecusa(await op.resultado,/Mensagem não encontrada ou mudou de situação\./);expect((await prisma.intencaoMensagem.findUniqueOrThrow({where:{id:nova.id}})).status).toBe("ENVIANDO");expect(await contar(c)).toBe(1);}
 catch(erro){primario=erro;throw erro;}finally {await limpar(primario,h,observer,op);}
});
it("SQL espera FK contato e rollback total se ator é revogado antes de concluir",async()=>{
 const c=await fixture();let h:Holder|undefined,observer:Client|undefined,op:Operacao|undefined,primario:unknown;
 try {h=await holder('SELECT id FROM "ContatoWhatsApp" WHERE id=$1 FOR UPDATE',c.contato.id);observer=await conectar();op=iniciar(c.dono.id,criar(c));await esperar(observer,h,op,'"IntencaoMensagem"',"insert");await h.pg.query('UPDATE "Usuario" SET ativo=false WHERE id=$1',[c.dono.id]);await h.pg.query("COMMIT");exigirRecusa(await op.resultado,/sessão.*ativa/i);expect(await prisma.intencaoMensagem.count()).toBe(0);expect(await contar(c)).toBe(0);}
 catch(erro){primario=erro;throw erro;}finally {await limpar(primario,h,observer,op);}
});
it("SQL operação conclui usando cliente configurado com pool de uma conexão",async()=>{
 const c=await fixture();const url=new URL(process.env.DATABASE_URL!);url.searchParams.set("connection_limit","1");const pool=new PrismaClient({datasources:{db:{url:url.toString()}}});
 try {const nova=await executarAgendadaInbox(pool,c.dono.id,criar(c));expect(await pool.intencaoMensagem.findUniqueOrThrow({where:{id:nova.id}})).toMatchObject({atendimentoId:c.atendimento.id,status:"PENDENTE"});}
 finally {await pool.$disconnect();}
});

it("SQL replay recupera recibo após transferência com ACL de leitura mantida",async()=>{
 const c=await fixture();const comando=criar(c);const primeira=await executarAgendadaInbox(prisma,c.dono.id,comando);
 await prisma.atendimentoWhatsApp.update({where:{id:c.atendimento.id},data:{responsavelId:c.outro.id}});
 expect(await atendimentoVisivel(c.dono,c.atendimento.id,false,prisma)).not.toBeNull();
 expect(await executarAgendadaInbox(prisma,c.dono.id,comando)).toEqual(primeira);expect(await contar(c)).toBe(1);expect(await prisma.intencaoMensagem.count()).toBe(1);
});
it("SQL autorização é refeita após esperar advisory da mesma chave",async()=>{
 const c=await fixture();const comando=criar(c);let h:Holder|undefined,observer:Client|undefined,op:Operacao|undefined,primario:unknown;
 try {h=await holder('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',`idem:MensagemAgendada:${c.dono.id}:${comando.chaveIdempotencia}`);observer=await conectar();op=iniciar(c.dono.id,comando);await esperar(observer,h,op,"pg_advisory_xact_lock","advisory");await h.pg.query('UPDATE "Usuario" SET ativo=false WHERE id=$1',[c.dono.id]);await h.pg.query("COMMIT");exigirRecusa(await op.resultado,/sessão.*ativa/i);expect(await prisma.intencaoMensagem.count()).toBe(0);expect(await contar(c)).toBe(0);}
 catch(erro){primario=erro;throw erro;}finally {await limpar(primario,h,observer,op);}
});
it("SQL cria e commita enquanto KEY SHARE alheio no pai continua retido",async()=>{
 const c=await fixture();let h:Holder|undefined,op:Operacao|undefined,primario:unknown;
 try {h=await holder('SELECT id FROM "AtendimentoWhatsApp" WHERE id=$1 FOR KEY SHARE',c.atendimento.id);op=iniciar(c.dono.id,criar(c));const limite=Date.now()+2000;while(!op.terminou()&&Date.now()<limite)await new Promise(r=>setTimeout(r,20));expect(op.terminou(),"deve concluir antes de liberar holder e antes de timeout TX").toBe(true);const r=await op.resultado;expect(r).toHaveProperty("valor.id");expect(await contar(c)).toBe(1);expect(await prisma.intencaoMensagem.count()).toBe(1);}
 catch(erro){primario=erro;throw erro;}finally {await limpar(primario,h,undefined,op);}
});

async function grafoClaim(observer:Client,h:Holder,op:Operacao,holderTerminou:()=>boolean){
 const worker=await workerPid(op);const limite=Date.now()+500;
 do {await observer.query("SELECT pg_stat_clear_snapshot()");const r=await observer.query<{pid:number;state:string;wait_event_type:string;wait_event:string;query:string;bloqueadores:number[]}>("SELECT pid,state,wait_event_type,wait_event,query,pg_blocking_pids(pid) bloqueadores FROM pg_stat_activity WHERE pid=ANY($1::int[]) AND datname=current_database()",[[worker,h.pid]]);
  for(const row of r.rows)op.diag.samples.push({ms:Date.now()-op.diag.inicio,pid:row.pid,role:row.pid===worker?"worker":"holder",state:row.state,waitType:row.wait_event_type,waitEvent:row.wait_event,knownBlockers:row.bloqueadores,sql:flagsSQL(row.query),stage:op.diag.timeline.at(-1)?.stage??null,terminou:op.terminou()});
  while(op.diag.samples.length>30)op.diag.samples.shift();
  if(holderTerminou()||r.rows.some(x=>x.pid===worker&&x.bloqueadores.includes(h.pid))&&r.rows.some(x=>x.pid===h.pid&&x.bloqueadores.includes(worker)))return;
  await new Promise(r=>setTimeout(r,20));
 }while(Date.now()<limite);
}
it("SQL ciclo real claim ENVIANDO após worker travar pai preserva recusa de domínio",async()=>{
 const c=await fixture();const nova=await executarAgendadaInbox(prisma,c.dono.id,criar(c));let h:Holder|undefined,observer:Client|undefined,op:Operacao|undefined,primario:unknown;
 let claim:Promise<{sucesso:true}|{erro:unknown}>|undefined;
 try {
  h=await holder('SELECT id FROM "IntencaoMensagem" WHERE id=$1 FOR UPDATE',nova.id);observer=await conectar();
  op=iniciar(c.dono.id,{tipo:"REAGENDAR",atendimentoId:c.atendimento.id,intencaoId:nova.id,agendadaPara:diaUtilAs(11,"America/Costa_Rica").toISOString()});
  await esperar(observer,h,op,'"IntencaoMensagem"');fase(op.diag,"holder.before.UPDATE_ENVIANDO.afterWorkerIntencaoWait");
  let holderTerminou=false;
  claim=h.pg.query('UPDATE "IntencaoMensagem" SET status=\'ENVIANDO\' WHERE id=$1',[nova.id]).then(()=>({sucesso:true as const}),(erro:unknown)=>({erro})).finally(()=>{holderTerminou=true;});
  await grafoClaim(observer,h,op,()=>holderTerminou);
  const resultadoHolder=await claim;
  op.diag.holderEnding="erro" in resultadoHolder?{sucesso:false,...resumoErro(resultadoHolder.erro)}:{sucesso:true};
  if("erro" in resultadoHolder)await h.pg.query("ROLLBACK");else await h.pg.query("COMMIT");
  const resultadoWorker=await op.resultado;
  expect(op.diag.holderEnding,"holder deve confirmar claim sem erro de lock/infra").toEqual({sucesso:true});
  exigirRecusa(resultadoWorker,/Mensagem não encontrada ou mudou de situação\./);
  expect((await prisma.intencaoMensagem.findUniqueOrThrow({where:{id:nova.id}})).status).toBe("ENVIANDO");expect(await contar(c)).toBe(1);
 }catch(erro){primario=erro;throw erro;}finally {
  try{await limpar(primario,h,observer,op);}finally{if(claim)await claim;}
 }
});

it("SQL recibo confirmado não escreve Config/Evento/intenção após optout, fechamento e claim",async()=>{
 const c=await fixture();const comando=criar(c);const primeira=await executarAgendadaInbox(prisma,c.dono.id,comando);
 await prisma.contatoWhatsApp.update({where:{id:c.contato.id},data:{optOutEm:new Date()}});
 await prisma.atendimentoWhatsApp.update({where:{id:c.atendimento.id},data:{status:"ENCERRADO",encerradoEm:new Date(),responsavelId:c.outro.id}});
 await prisma.intencaoMensagem.update({where:{id:primeira.id},data:{status:"ENVIANDO"}});
 const foto=async()=>({config:await prisma.configIA.findMany(),intencoes:await prisma.intencaoMensagem.findMany(),eventos:await prisma.evento.findMany({where:{agregadoId:c.atendimento.id}})});
 const antes=await foto();const op=iniciar(c.dono.id,comando);const resultado=await op.resultado;
 expect(resultado).toEqual({valor:primeira});expect(await foto()).toEqual(antes);
 expect(op.diag.timeline.filter(x=>/^before\.(configIA\.upsert|intencaoMensagem\.(create|updateMany)|evento\.create)$/.test(x.stage))).toEqual([]);
});
it("SQL recibo recusa perda real de leitura durante espera sem novos efeitos",async()=>{
 const c=await fixture();const comando=criar(c);const nova=await executarAgendadaInbox(prisma,c.dono.id,comando);let h:Holder|undefined,observer:Client|undefined,op:Operacao|undefined,primario:unknown;
 try {h=await holder('SELECT id FROM "IntencaoMensagem" WHERE id=$1 FOR UPDATE',nova.id);observer=await conectar();op=iniciar(c.dono.id,comando);await esperar(observer,h,op,'"IntencaoMensagem"');
  await h.pg.query('UPDATE "Lead" SET "vendedorDonoId"=$1 WHERE id=$2',[c.outro.id,c.op.id]);
  await h.pg.query('UPDATE "NumeroWhatsApp" SET "donoId"=$1 WHERE id=$2',[c.outro.id,c.numero.id]);await h.pg.query("COMMIT");
  expect(await atendimentoVisivel(c.dono,c.atendimento.id,false,prisma)).toBeNull();exigirRecusa(await op.resultado,/^Atendimento não encontrado\.$/);expect(await contar(c)).toBe(1);expect(await prisma.intencaoMensagem.count()).toBe(1);
 }catch(erro){primario=erro;throw erro;}finally {await limpar(primario,h,observer,op);}
});
it("SQL Admin recupera seu recibo de alteração de intenção originalmente de vendedor",async()=>{
 const c=await fixture();const nova=await executarAgendadaInbox(prisma,c.dono.id,criar(c));
 await prisma.atendimentoWhatsApp.update({where:{id:c.atendimento.id},data:{responsavelId:c.admin.id}});
 const comando={tipo:"REAGENDAR" as const,atendimentoId:c.atendimento.id,intencaoId:nova.id,agendadaPara:diaUtilAs(11,"America/Costa_Rica").toISOString(),chaveIdempotencia:"native-admin-recibo-362"};
 expect(await executarAgendadaInbox(prisma,c.admin.id,comando)).toEqual(nova);
 await prisma.atendimentoWhatsApp.update({where:{id:c.atendimento.id},data:{responsavelId:c.dono.id}});
 await prisma.intencaoMensagem.update({where:{id:nova.id},data:{status:"DESPACHADA",agendadaPara:null}});
 const antes=await prisma.intencaoMensagem.findUniqueOrThrow({where:{id:nova.id}});expect(antes.autorId).toBe(c.dono.id);
 expect(await executarAgendadaInbox(prisma,c.admin.id,comando)).toEqual(nova);expect(await prisma.intencaoMensagem.findUniqueOrThrow({where:{id:nova.id}})).toEqual(antes);expect(await contar(c)).toBe(2);
});