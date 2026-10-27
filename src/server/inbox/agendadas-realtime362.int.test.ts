import {afterAll,beforeEach,expect,it,vi} from "vitest";
import type {Prisma} from "@prisma/client";
import {Client} from "pg";
import {mkdtemp,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {prisma} from "@/lib/prisma";
import {ErroRegra} from "@/server/_shared/sessao";
import {truncarBanco} from "@/test/integracao";
import {cenarioCadastroPessoa} from "@/test/inbox-cadastro-pessoa";
import {diaUtilAs} from "@/test/janela-envio";
import {atendimentoVisivel} from "@/server/whatsapp/atendimentos";
import {CANAL_INBOX} from "./barramento";
import {cancelarAgendadaInboxTx} from "./agendadas-cancelamento";
import {executarAgendadaInbox,type BancoAgendadaInbox,type ComandoAgendadaInbox} from "./agendadas-operacao-inbox";
beforeEach(()=>truncarBanco());afterAll(()=>prisma.$disconnect());
async function fixture(){const c=await cenarioCadastroPessoa();await prisma.oportunidade.update({where:{id:c.op.id},data:{telefoneE164:c.contato.telefoneE164}});await prisma.configIA.upsert({where:{id:"ia"},create:{id:"ia"},update:{}});await prisma.atendimentoWhatsApp.update({where:{id:c.atendimento.id},data:{responsavelId:c.dono.id,iaPausadaEm:new Date()}});const a=await atendimentoVisivel(c.dono,c.atendimento.id,true,prisma);expect(a?.responsavelId).toBe(c.dono.id);expect(a?.contato.telefoneE164).toBe(c.contato.telefoneE164);return c;}
type Cenario=Awaited<ReturnType<typeof fixture>>;
const criar=(c:Cenario):Extract<ComandoAgendadaInbox,{tipo:"CRIAR"}>=>({tipo:"CRIAR",atendimentoId:c.atendimento.id,texto:"Texto fictício restrito362",agendadaPara:diaUtilAs(10,"America/Costa_Rica").toISOString(),chaveIdempotencia:"realtime-criar-362"});
async function conectar(){const pg=new Client({connectionString:process.env.DATABASE_URL});try{await pg.connect();return pg;}catch(erro){const fim=await Promise.allSettled([pg.end()]);const falhas=fim.flatMap(x=>x.status==="rejected"?[x.reason]:[]);if(falhas.length)throw new AggregateError([erro,...falhas],"connect e cleanup");throw erro;}}
async function fecharHolder(pg:Client){const erros:unknown[]=[];try{await pg.query("ROLLBACK");}catch(erro){erros.push(erro);}finally{try{await pg.end();}catch(erro){erros.push(erro);}}if(erros.length)throw new AggregateError(erros,"holder cleanup");}
const pausa=()=>new Promise(r=>setTimeout(r,100));
type Escuta={pg:Client;avisos:Record<string,unknown>[];falhas:string[]};
async function escutar<T>(c:Cenario,caso:string,fn:(l:Escuta)=>Promise<T>){
 const pg=await conectar();const l:Escuta={pg,avisos:[],falhas:[]};let primario:unknown;
 pg.on("error",()=>l.falhas.push("pg-error"));pg.on("notification",n=>{if(n.channel!==CANAL_INBOX||!n.payload)return;try{const aviso=JSON.parse(n.payload) as Record<string,unknown>;if(aviso.atendimentoId===c.atendimento.id)l.avisos.push(aviso);}catch{l.falhas.push("invalid-json");}});
 try{await pg.query("LISTEN "+CANAL_INBOX);return await fn(l);}catch(erro){primario=erro;throw erro;}finally{
  const fim=await Promise.allSettled([pg.end()]);const erros=fim.flatMap(x=>x.status==="rejected"?[x.reason]:[]);
  try{const dir=await mkdtemp(join(tmpdir(),"inbox362-listen-"));const path=join(dir,"curated.json");await writeFile(path,JSON.stringify({caso,atendimentoId:c.atendimento.id,conversaId:c.conversa.id,count:l.avisos.length,keys:l.avisos.map(a=>Object.keys(a).sort()),avisos:l.avisos.map(a=>({tipo:a.tipo,atendimentoId:a.atendimentoId,mensagemId:a.mensagemId,conversaId:a.conversaId})),falhas:l.falhas,cleanup:fim.map(x=>x.status)},null,2));console.info("Evidência LISTEN362:",path);}catch(erro){erros.push(erro);}
  if(erros.length)throw new AggregateError([...(primario?[primario]:[]),...erros],"Erro primário/cleanup LISTEN");
 }
}
async function umAviso(l:Escuta,c:Cenario){await vi.waitFor(()=>expect(l.avisos).toHaveLength(1),{timeout:1500,interval:20});await pausa();expect(l.avisos).toHaveLength(1);expect(l.falhas).toEqual([]);expect(Object.keys(l.avisos[0]!).sort()).toEqual(["tipo","atendimentoId","mensagemId","conversaId"].sort());expect(l.avisos[0]).toEqual({tipo:"atendimento.atualizado",atendimentoId:c.atendimento.id,mensagemId:null,conversaId:c.conversa.id});}
async function semAviso(l:Escuta){await pausa();expect(l.avisos).toEqual([]);expect(l.falhas).toEqual([]);}
async function prontoOuFim<T>(pronto:Promise<T>,fim:Promise<unknown>){let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([pronto,fim.then(()=>{throw new Error("Operação encerrou antes da barreira");}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("Barreira não atingida em 2s")),2000);})]);}finally{if(timer)clearTimeout(timer);}}
it("LISTEN CRIAR publica somente IDs após commit, nunca enquanto TX está aberta",async()=>{
 const c=await fixture();await escutar(c,"criar-commit",async l=>{
  let sinal!:()=>void,liberar!:()=>void;const pronto=new Promise<void>(r=>sinal=r),libera=new Promise<void>(r=>liberar=r);
  const db={$transaction:async<T>(fn:(tx:Prisma.TransactionClient)=>Promise<T>)=>prisma.$transaction(async tx=>{const r=await fn(tx);sinal();await libera;return r;})} as unknown as BancoAgendadaInbox;
  const op=executarAgendadaInbox(db,c.dono.id,criar(c)).then(valor=>({valor}),(erro:unknown)=>({erro}));
  try{await prontoOuFim(pronto,op);await semAviso(l);}finally{liberar();await op;}
  const r=await op;expect(r).toHaveProperty("valor.id");await umAviso(l,c);
 });
});
it("LISTEN REAGENDAR publica um aviso de IDs para uma operação em sua TX",async()=>{
 const c=await fixture();const nova=await executarAgendadaInbox(prisma,c.dono.id,criar(c));await escutar(c,"reagendar",async l=>{await executarAgendadaInbox(prisma,c.dono.id,{tipo:"REAGENDAR",atendimentoId:c.atendimento.id,intencaoId:nova.id,agendadaPara:diaUtilAs(11,"America/Costa_Rica").toISOString()});await umAviso(l,c);});
});
it("LISTEN ENVIAR_AGORA publica um aviso sem despacho direto",async()=>{
 const c=await fixture();const nova=await executarAgendadaInbox(prisma,c.dono.id,criar(c));await escutar(c,"enviar-agora",async l=>{await executarAgendadaInbox(prisma,c.dono.id,{tipo:"ENVIAR_AGORA",atendimentoId:c.atendimento.id,intencaoId:nova.id});expect((await prisma.intencaoMensagem.findUniqueOrThrow({where:{id:nova.id}})).status).toBe("PENDENTE");await umAviso(l,c);});
});
it("LISTEN replay próprio não publica aviso nem outro Evento",async()=>{
 const c=await fixture();const comando=criar(c);const nova=await executarAgendadaInbox(prisma,c.dono.id,comando);await escutar(c,"replay-zero",async l=>{expect(await executarAgendadaInbox(prisma,c.dono.id,comando)).toEqual(nova);await semAviso(l);expect(await prisma.evento.count({where:{tipo:"MensagemAgendada",agregadoId:c.atendimento.id}})).toBe(1);});
});
it("LISTEN rollback por revogação durante FK não publica aviso nem preserva intenção/Evento",async()=>{
 const c=await fixture();await escutar(c,"rollback-zero",async l=>{
  let h:Client|undefined,op:Promise<{valor:{id:string}}|{erro:unknown}>|undefined,primario:unknown;
  try{
   h=await conectar();await h.query("BEGIN");await h.query('SELECT id FROM "ContatoWhatsApp" WHERE id=$1 FOR UPDATE',[c.contato.id]);const hr=await h.query<{pid:number}>("SELECT pg_backend_pid() pid");const holder=hr.rows[0]!.pid;
   let sinal!:(pid:number)=>void;const pronto=new Promise<number>(r=>sinal=r);
   const db={$transaction:async<T>(fn:(tx:Prisma.TransactionClient)=>Promise<T>)=>prisma.$transaction(async tx=>{const [r]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() pid`;sinal(r!.pid);return fn(tx);})} as unknown as BancoAgendadaInbox;
   op=executarAgendadaInbox(db,c.dono.id,criar(c)).then(valor=>({valor}),(erro:unknown)=>({erro}));const worker=await prontoOuFim(pronto,op);const lr=await l.pg.query<{pid:number}>("SELECT pg_backend_pid() pid");expect(worker).not.toBe(holder);expect(worker).not.toBe(lr.rows[0]!.pid);
   let observou=false;const limite=Date.now()+2000;let terminou=false;void op.finally(()=>{terminou=true;});
   while(Date.now()<limite){if(terminou)throw new Error("Worker encerrou antes da espera FK");await l.pg.query("SELECT pg_stat_clear_snapshot()");const r=await l.pg.query<{state:string;wait_event_type:string;query:string;blockers:number[]}>("SELECT state,wait_event_type,query,pg_blocking_pids(pid) blockers FROM pg_stat_activity WHERE pid=$1 AND datname=current_database()",[worker]);const row=r.rows[0];if(row?.state==="active"&&row.wait_event_type==="Lock"&&row.query.includes("INSERT INTO")&&row.query.includes('"IntencaoMensagem"')&&row.blockers.includes(holder)){observou=true;break;}await new Promise(r=>setTimeout(r,20));}
   expect(observou,"worker deve esperar a FK de contato selecionada").toBe(true);await h.query('UPDATE "Usuario" SET ativo=false WHERE id=$1',[c.dono.id]);await h.query("COMMIT");const r=await op;expect(r).toHaveProperty("erro");if(!("erro" in r))throw new Error("Revogação foi ignorada");expect((r.erro as {code?:string})?.code).not.toBe("P2028");expect(r.erro instanceof ErroRegra).toBe(true);expect((r.erro as Error).message).toMatch(/sessão.*ativa/i);
   expect(await prisma.intencaoMensagem.count()).toBe(0);expect(await prisma.evento.count({where:{tipo:"MensagemAgendada",agregadoId:c.atendimento.id}})).toBe(0);await semAviso(l);
  }catch(erro){primario=erro;throw erro;}finally{const fim=await Promise.allSettled([...(h?[fecharHolder(h)]:[])]);const erros=fim.flatMap(x=>x.status==="rejected"?[x.reason]:[]);if(op)await op;if(erros.length)throw new AggregateError([...(primario?[primario]:[]),...erros],"rollback fixture cleanup");}
 });
});
it("LISTEN cancel333 conserva exatamente seu aviso existente, replay não duplica",async()=>{
 const c=await fixture();const nova=await executarAgendadaInbox(prisma,c.dono.id,criar(c));await escutar(c,"cancel333-one",async l=>{await cancelarAgendadaInboxTx(c.dono,c.atendimento.id,nova.id);await umAviso(l,c);await cancelarAgendadaInboxTx(c.dono,c.atendimento.id,nova.id);await pausa();expect(l.avisos).toHaveLength(1);});
});
it("LISTEN publica e conclui sob KEY SHARE do pai ainda retido sem upgrade",async()=>{
 const c=await fixture();await escutar(c,"keyshare-commit",async l=>{let h:Client|undefined,op:Promise<{valor:{id:string}}|{erro:unknown}>|undefined,primario:unknown;try{h=await conectar();await h.query("BEGIN");await h.query('SELECT id FROM "AtendimentoWhatsApp" WHERE id=$1 FOR KEY SHARE',[c.atendimento.id]);let terminou=false;op=executarAgendadaInbox(prisma,c.dono.id,criar(c)).then(valor=>({valor}),(erro:unknown)=>({erro})).finally(()=>{terminou=true;});const limite=Date.now()+2000;while(!terminou&&Date.now()<limite)await new Promise(r=>setTimeout(r,20));expect(terminou,"comando deve commitar antes da liberação KEY SHARE").toBe(true);expect(await op).toHaveProperty("valor.id");await umAviso(l,c);}catch(erro){primario=erro;throw erro;}finally{const fim=await Promise.allSettled([...(h?[fecharHolder(h)]:[])]);const erros=fim.flatMap(x=>x.status==="rejected"?[x.reason]:[]);if(op)await op;if(erros.length)throw new AggregateError([...(primario?[primario]:[]),...erros],"KEY SHARE cleanup");}});
});
