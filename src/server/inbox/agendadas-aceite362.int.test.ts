import {afterAll,beforeEach,expect,it,vi} from "vitest";
import {Client} from "pg";
import {mkdtemp,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {ErroRegra,ErroPermissao} from "@/server/_shared/sessao";
import {cancelarAgendadaInboxTx} from "./agendadas-cancelamento";
import {CANAL_INBOX} from "./barramento";
import {carregarAtividadePainel} from "./painel-atividade";
import {Papel,type Prisma} from "@prisma/client";
const m=vi.hoisted(()=>({auth:vi.fn()}));
vi.mock("@/lib/auth",()=>({auth:m.auth}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {prisma} from "@/lib/prisma";
import {criarUsuario,seedCatalogoMinimo,configurarFusoDaEscola,truncarBanco} from "@/test/integracao";
import {cenarioCadastroPessoa} from "@/test/inbox-cadastro-pessoa";
import {criarNumeroSetor} from "@/test/integracao-whatsapp";
import {diaUtilAs} from "@/test/janela-envio";
import {valorCampoLocal} from "@/server/operacao/fuso-entrada";
import {atendimentoVisivel,garantirAtendimento} from "@/server/whatsapp/atendimentos";
import {agendarMensagemNoAtendimento,reagendarAgendamentoDoAtendimento,enviarAgendamentoAgoraDoAtendimento,cancelarAgendamentoDoAtendimento} from "@/server/whatsapp/acoes-conversa";
import {agendadasDoAtendimento} from "@/server/whatsapp/consultas-acoes-atendimento";
import {reagendarMensagem,enviarAgora,cancelarMensagemAgendada} from "@/server/crm/mensagens-agendadas";
import {capacidadesCrm} from "@/server/crm/permissoes";
beforeEach(async()=>{await truncarBanco();m.auth.mockReset();});afterAll(()=>prisma.$disconnect());
const como=(u:{id:string})=>m.auth.mockResolvedValue({user:{id:u.id}});
async function comercial(){const c=await cenarioCadastroPessoa();await prisma.oportunidade.update({where:{id:c.op.id},data:{telefoneE164:c.contato.telefoneE164}});await prisma.configIA.upsert({where:{id:"ia"},create:{id:"ia"},update:{}});await prisma.atendimentoWhatsApp.update({where:{id:c.atendimento.id},data:{responsavelId:c.dono.id,iaPausadaEm:new Date()}});expect(await atendimentoVisivel(c.dono,c.atendimento.id,true,prisma)).not.toBeNull();como(c.dono);return c;}
function idDe(r:{ok:boolean;dado?:{id:string};erro?:string}){expect(r.ok,r.erro).toBe(true);if(!r.ok||!r.dado)throw new Error("Agendamento de fixture não confirmou");return r.dado.id;}
const idOrdenado=(n:number)=>"aceite362-"+String(n).padStart(3,"0");
it("aceite reader limita50 e ordena data/id, inclui HUMANO/IA e expõe somente DTO mínimo",async()=>{
 const c=await comercial();const quando=diaUtilAs(10,"America/Costa_Rica");
 const rows=Array.from({length:56},(_,i):Prisma.IntencaoMensagemCreateManyInput=>({id:idOrdenado(55-i),atendimentoId:c.atendimento.id,numeroId:c.numero.id,contatoId:c.contato.id,origem:i%2===0?"HUMANO":"IA",autorId:i%2===0?c.dono.id:null,status:i%3===0?"ADIADA":"PENDENTE",agendadaPara:new Date(quando.getTime()+Math.floor(i/28)*60_000),corpoRenderizado:"Fictício aceite "+i,...(i===2?{tipo:"DOCUMENTO",midiaPath:"/whatsapp-out/privado-aceite362.pdf"}:{}),...(i===3?{conteudo:{segredo:"conteudoPrivado362"}}:{})}));
 await prisma.intencaoMensagem.createMany({data:rows});
 const dto=await agendadasDoAtendimento(c.atendimento.id);
 expect(dto.map(x=>x.id)).toEqual([...Array.from({length:28},(_,i)=>idOrdenado(28+i)),...Array.from({length:22},(_,i)=>idOrdenado(i))]);expect(dto).toHaveLength(50);
 expect(dto.find(x=>x.id===idOrdenado(28))).toMatchObject({autor:"aria",podeAlterar:false});expect(dto.find(x=>x.id===idOrdenado(29))).toMatchObject({autor:"voce",podeAlterar:true});
 expect(dto.find(x=>x.id===idOrdenado(53))?.temAnexo).toBe(true);expect(dto.find(x=>x.id===idOrdenado(52))?.temAnexo).toBe(true);
 const base=["agendadaPara","autor","autorNome","id","perguntaPendente","podeAlterar","status","temAnexo","texto","tipo"];
 for(const linha of dto)expect(Object.keys(linha).filter(k=>k!=="editavel"&&k!=="anexoNome").sort()).toEqual(base);
 expect(JSON.stringify(dto)).not.toContain("privado-aceite362");expect(JSON.stringify(dto)).not.toContain("conteudoPrivado362");expect(JSON.stringify(dto)).not.toContain(c.contato.telefoneE164);
});
it("aceite filtros reais, invisível/encerrado retornam[] e recusam reagendar/enviar sem efeitos",async()=>{
 const c=await comercial();const quando=diaUtilAs(10,"America/Costa_Rica");const id=idDe(await agendarMensagemNoAtendimento({atendimentoId:c.atendimento.id,texto:"Válida",quando:quando.toISOString()}));
 const base={atendimentoId:c.atendimento.id,numeroId:c.numero.id,contatoId:c.contato.id,origem:"HUMANO" as const,autorId:c.dono.id,agendadaPara:quando,corpoRenderizado:"Não publicar"};
 await prisma.intencaoMensagem.createMany({data:[{...base,agendadaPara:null},{...base,status:"CANCELADA"},{...base,status:"ENVIANDO"},{...base,origem:"LOTE"},{...base,passo:"D-7"},{...base,passoComercial:"+30min"},{...base,atendimentoId:null}]});
 expect((await agendadasDoAtendimento(c.atendimento.id)).map(x=>x.id)).toEqual([id]);const eventos=await prisma.evento.count({where:{agregadoId:c.atendimento.id}});
 const entrada={atendimentoId:c.atendimento.id,intencaoId:id,quandoLocal:valorCampoLocal(diaUtilAs(11,"America/Costa_Rica"),"America/Costa_Rica"),fuso:"America/Costa_Rica"};
 como(c.outro);expect(await agendadasDoAtendimento(c.atendimento.id)).toEqual([]);expect(await atendimentoVisivel(c.outro,c.atendimento.id,true,prisma)).toBeNull();
 expect(await reagendarAgendamentoDoAtendimento(entrada)).toEqual({ok:false,erro:"Atendimento não encontrado."});expect(await enviarAgendamentoAgoraDoAtendimento({atendimentoId:c.atendimento.id,intencaoId:id})).toEqual({ok:false,erro:"Atendimento não encontrado."});
 como(c.dono);await prisma.atendimentoWhatsApp.update({where:{id:c.atendimento.id},data:{status:"ENCERRADO",encerradoEm:new Date()}});expect(await agendadasDoAtendimento(c.atendimento.id)).toEqual([]);
 expect(await reagendarAgendamentoDoAtendimento(entrada)).toEqual({ok:false,erro:"Atendimento não encontrado."});expect(await enviarAgendamentoAgoraDoAtendimento({atendimentoId:c.atendimento.id,intencaoId:id})).toEqual({ok:false,erro:"Atendimento não encontrado."});
 expect((await prisma.intencaoMensagem.findUniqueOrThrow({where:{id}})).agendadaPara).toEqual(quando);expect(await prisma.evento.count({where:{agregadoId:c.atendimento.id}})).toBe(eventos);
});
async function pedagogico(){
 const cat=await seedCatalogoMinimo();const gp=await criarUsuario([Papel.GERENTE_PEDAGOGICO],"GP fictício aceite362");const professor=await criarUsuario([Papel.PROFESSOR],"Docente fictício aceite362");
 const nivel=await prisma.nivel.create({data:{idiomaId:cat.idioma.id,codigo:"A1",ordem:1}});const turma=await prisma.turma.create({data:{nivelId:nivel.id,modalidadeId:cat.modalidade.id,professorId:professor.id}});await prisma.vinculoDocente.create({data:{turmaId:turma.id,professorId:professor.id,inicio:new Date(Date.now()-60_000)}});
 const aluno=await prisma.aluno.create({data:{primeiroNome:"Aluna fictícia",sobrenome:"Aceite362",paisId:cat.pais.id,telefoneE164:"+5060000362001",whatsapp:true}});
 const matricula=await prisma.matricula.create({data:{alunoId:aluno.id,produtoId:cat.produto.id,paisId:cat.pais.id,moeda:"CRC",codigo:"ACEITE-GP-362"}});await prisma.alocacaoTurma.create({data:{alunoId:aluno.id,turmaId:turma.id,matriculaId:matricula.id}});
 const numero=await criarNumeroSetor({telefoneE164:"+5500000362001",setores:["PEDAGOGICO"]});const contato=await prisma.contatoWhatsApp.create({data:{telefoneE164:aluno.telefoneE164!,alunoId:aluno.id}});
 const atendimento=await prisma.$transaction(tx=>garantirAtendimento(tx,{numeroId:numero.id,contatoId:contato.id,finalidade:"PEDAGOGICO",alunoId:aluno.id,matriculaId:matricula.id,turmaId:turma.id,responsavelId:gp.id}));await prisma.atendimentoWhatsApp.update({where:{id:atendimento.id},data:{iaPausadaEm:new Date()}});await configurarFusoDaEscola("America/Costa_Rica");await prisma.configIA.upsert({where:{id:"ia"},create:{id:"ia"},update:{}});
 const a=await atendimentoVisivel(gp,atendimento.id,true,prisma);expect(a).toMatchObject({finalidade:"PEDAGOGICO",alunoId:aluno.id,matriculaId:matricula.id,turmaId:turma.id,responsavelId:gp.id,autorizacaoComunicacaoAcademicaId:null});expect(a?.contato.alunoId).toBe(aluno.id);expect(a?.contato.telefoneE164).toBe(aluno.telefoneE164);expect(capacidadesCrm(gp.papeis).has("tarefas.ver")).toBe(false);como(gp);return {gp,atendimento};
}
it("aceite GP acadêmico próprio sem tarefas opera ações e replays, CRM mantém negativa",async()=>{
 const c=await pedagogico();const criar={atendimentoId:c.atendimento.id,texto:"GP fictício",quando:diaUtilAs(10,"America/Costa_Rica").toISOString(),chaveIdempotencia:"aceite-gp-criar-362"};const id=idDe(await agendarMensagemNoAtendimento(criar));expect(idDe(await agendarMensagemNoAtendimento(criar))).toBe(id);
 const crmQuando=diaUtilAs(11,"America/Costa_Rica").toISOString();expect(await reagendarMensagem(id,crmQuando)).toEqual({ok:false,erro:"Você não tem acesso a esta função do CRM."});expect(await enviarAgora(id)).toEqual({ok:false,erro:"Você não tem acesso a esta função do CRM."});expect((await prisma.intencaoMensagem.findUniqueOrThrow({where:{id}})).agendadaPara?.toISOString()).toBe(criar.quando);
 const reagendar={atendimentoId:c.atendimento.id,intencaoId:id,quandoLocal:valorCampoLocal(crmQuando,"America/Costa_Rica"),fuso:"America/Costa_Rica",chaveIdempotencia:"aceite-gp-reagendar-362"};expect(idDe(await reagendarAgendamentoDoAtendimento(reagendar))).toBe(id);expect(idDe(await reagendarAgendamentoDoAtendimento(reagendar))).toBe(id);
 const conflito=await reagendarAgendamentoDoAtendimento({...reagendar,quandoLocal:valorCampoLocal(diaUtilAs(12,"America/Costa_Rica"),"America/Costa_Rica")});expect(conflito.ok).toBe(false);if(!conflito.ok)expect(conflito.erro).toMatch(/tentativa/);
 const operacaoConflitante=await enviarAgendamentoAgoraDoAtendimento({atendimentoId:c.atendimento.id,intencaoId:id,chaveIdempotencia:reagendar.chaveIdempotencia});expect(operacaoConflitante.ok).toBe(false);if(!operacaoConflitante.ok)expect(operacaoConflitante.erro).toMatch(/tentativa/);
 const enviar={atendimentoId:c.atendimento.id,intencaoId:id,chaveIdempotencia:"aceite-gp-enviar-362"};const inicio=Date.now();expect(idDe(await enviarAgendamentoAgoraDoAtendimento(enviar))).toBe(id);const final=await prisma.intencaoMensagem.findUniqueOrThrow({where:{id}});expect(final.status).toBe("PENDENTE");expect(final.agendadaPara!.getTime()).toBeGreaterThanOrEqual(inicio);expect(idDe(await enviarAgendamentoAgoraDoAtendimento(enviar))).toBe(id);expect((await prisma.intencaoMensagem.findUniqueOrThrow({where:{id}})).agendadaPara).toEqual(final.agendadaPara);
 expect(await prisma.intencaoMensagem.count()).toBe(1);expect(await prisma.evento.count({where:{agregadoId:c.atendimento.id,tipo:"MensagemAgendada"}})).toBe(1);expect(await prisma.evento.count({where:{agregadoId:c.atendimento.id,tipo:"MensagemReagendada"}})).toBe(2);

 expect(await cancelarMensagemAgendada(id)).toEqual({ok:false,erro:"Você não tem acesso a esta função do CRM."});
 expect((await carregarAtividadePainel(c.gp,c.atendimento.id))?.agendadas.find(x=>x.id===id)?.podeCancelar).toBe(true);
 await prisma.atendimentoWhatsApp.update({where:{id:c.atendimento.id},data:{status:"ENCERRADO",encerradoEm:new Date()}});
 expect(await atendimentoVisivel(c.gp,c.atendimento.id,false,prisma)).not.toBeNull();
 expect((await carregarAtividadePainel(c.gp,c.atendimento.id))?.agendadas.find(x=>x.id===id)?.podeCancelar).toBe(true);
 const listener=new Client({connectionString:process.env.DATABASE_URL}),avisos:Record<string,unknown>[]=[],falhas:string[]=[];let primario:unknown;
 listener.on("error",()=>falhas.push("pg-error"));listener.on("notification",n=>{if(n.channel!==CANAL_INBOX||!n.payload)return;try{const aviso=JSON.parse(n.payload) as Record<string,unknown>;if(aviso.atendimentoId===c.atendimento.id)avisos.push(aviso);}catch{falhas.push("invalid-json");}});
 try{
  await listener.connect();await listener.query("LISTEN "+CANAL_INBOX);
  const cancelar={atendimentoId:c.atendimento.id,intencaoId:id};
  expect(await cancelarAgendamentoDoAtendimento(cancelar)).toEqual({ok:true});
  await vi.waitFor(()=>expect(avisos).toHaveLength(1),{timeout:1500,interval:20});await listener.query("SELECT 1");await new Promise(r=>setTimeout(r,100));
  expect(avisos).toEqual([{tipo:"atendimento.atualizado",atendimentoId:c.atendimento.id,mensagemId:null,conversaId:c.atendimento.conversaId}]);
  expect(await cancelarAgendamentoDoAtendimento(cancelar)).toEqual({ok:true});await listener.query("SELECT 1");await new Promise(r=>setTimeout(r,100));
  expect(avisos).toHaveLength(1);expect(falhas).toEqual([]);
  expect(await prisma.evento.count({where:{agregadoId:c.atendimento.id,tipo:"MensagemAgendadaCancelada"}})).toBe(1);
  expect(await prisma.intencaoMensagem.findUniqueOrThrow({where:{id}})).toMatchObject({status:"CANCELADA",autorId:c.gp.id,origem:"HUMANO"});
  expect(await cancelarMensagemAgendada(id)).toEqual({ok:false,erro:"Você não tem acesso a esta função do CRM."});
  console.info("Aceite cancelGP362:",JSON.stringify({cancelEventos:1,avisos:avisos.length,replayDelta:0,closed:true}));
 }catch(erro){primario=erro;throw erro;}finally{const fim=await Promise.allSettled([listener.end()]);const erros=fim.flatMap(r=>r.status==="rejected"?[r.reason]:[]);if(erros.length)throw new AggregateError([...(primario?[primario]:[]),...erros],"CancelGP listener cleanup");}

});

type RevogacaoGP="responsavel"|"ativo"|"papel";
function erroCuradoGP(erro:unknown){const e=erro as {code?:unknown;meta?:{code?:unknown}};return {dominio:erro instanceof ErroRegra,permissao:erro instanceof ErroPermissao,code:typeof e?.code==="string"&&/^(P\d{4}|[0-9A-Z]{5})$/.test(e.code)?e.code:null,sqlState:typeof e?.meta?.code==="string"&&/^[0-9A-Z]{5}$/.test(e.meta.code)?e.meta.code:null};}
async function conectarGP(){const pg=new Client({connectionString:process.env.DATABASE_URL});try{await pg.connect();return pg;}catch(erro){const fim=await Promise.allSettled([pg.end()]);const erros=fim.flatMap(r=>r.status==="rejected"?[r.reason]:[]);if(erros.length)throw new AggregateError([erro,...erros],"connect/cleanup GP");throw erro;}}
async function finalizarHolderGP(pg:Client){const erros:unknown[]=[];try{await pg.query("ROLLBACK");}catch(erro){erros.push(erro);}finally{try{await pg.end();}catch(erro){erros.push(erro);}}if(erros.length)throw new AggregateError(erros,"holder cleanup GP");}
async function antesDeFimGP<T>(pronto:Promise<T>,fim:Promise<unknown>){let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([pronto,fim.then(()=>{throw new Error("Worker encerrou antes da fase instrumental GP");}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("Fase instrumental GP não chegou em 2s")),2000);})]);}finally{if(timer)clearTimeout(timer);}}
async function revogarDuranteCancelGP(c:Awaited<ReturnType<typeof pedagogico>>,id:string,qual:RevogacaoGP){
 expect((await prisma.usuario.findUniqueOrThrow({where:{id:c.gp.id}}))).toMatchObject({ativo:true,papeis:[Papel.GERENTE_PEDAGOGICO]});
 expect(await atendimentoVisivel(c.gp,c.atendimento.id,false,prisma)).toMatchObject({responsavelId:c.gp.id});
 expect((await carregarAtividadePainel(c.gp,c.atendimento.id))?.agendadas.find(x=>x.id===id)?.podeCancelar).toBe(true);
 expect(await prisma.intencaoMensagem.findUniqueOrThrow({where:{id}})).toMatchObject({autorId:c.gp.id,origem:"HUMANO",status:"PENDENTE"});
 let h:Client|undefined,o:Client|undefined,op:Promise<{sucesso:true}|{erro:unknown}>|undefined,primario:unknown;
 let sinalPid!:(pid:number)=>void,sinalPai!:()=>void,soltar!:()=>void;
 const prontoPid=new Promise<number>(r=>sinalPid=r),paiAdquirido=new Promise<void>(r=>sinalPai=r),liberar=new Promise<void>(r=>soltar=r);
 const inicio=Date.now(),timeline:{ms:number;fase:string}[]=[],samples:Record<string,unknown>[]=[],avisos:Record<string,unknown>[]=[],falhas:string[]=[];
 const fase=(f:string)=>timeline.push({ms:Date.now()-inicio,fase:f});
 let worker:number|undefined,holder:number|undefined,observer:number|undefined,terminou=false,holderCommit=false,baseline:number|undefined,delta:number|undefined,ending:Record<string,unknown>|undefined,cleanup:string[]=[];
 try{
  o=await conectarGP();o.on("error",()=>falhas.push("pg-error"));o.on("notification",n=>{if(n.channel!==CANAL_INBOX||!n.payload)return;try{const a=JSON.parse(n.payload) as Record<string,unknown>;if(a.atendimentoId===c.atendimento.id)avisos.push(a);}catch{falhas.push("invalid-json");}});
  await o.query("LISTEN "+CANAL_INBOX);observer=(await o.query<{pid:number}>("SELECT pg_backend_pid() pid")).rows[0]!.pid;
  h=await conectarGP();await h.query("BEGIN");await h.query('SELECT id FROM "AtendimentoWhatsApp" WHERE id=$1 FOR NO KEY UPDATE',[c.atendimento.id]);holder=(await h.query<{pid:number}>("SELECT pg_backend_pid() pid")).rows[0]!.pid;fase("holder.parent.locked");
  const db={$transaction:async<T>(fn:(tx:Prisma.TransactionClient)=>Promise<T>)=>prisma.$transaction(async tx=>{
   const [pid]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() pid`;worker=pid!.pid;sinalPid(worker);fase("worker.pid");
   const observado=new Proxy(tx,{get(target,key){const value=Reflect.get(target,key);if(key==="$queryRaw"&&typeof value==="function")return async(...args:unknown[])=>{const q=args[0],sql=Array.isArray(q)?q.join("?"):((q as {strings?:string[]})?.strings??[]).join("?");const pai=sql.includes('"AtendimentoWhatsApp"')&&sql.includes("FOR SHARE");if(pai)fase("before.parent.SHARE");const r=await Reflect.apply(value,target,args);if(pai){fase("after.parent.SHARE.pause");sinalPai();await liberar;fase("after.parent.SHARE.release");}return r;};return typeof value==="function"?value.bind(target):value;}});
   return fn(observado);
  })} as unknown as typeof prisma;
  op=cancelarAgendadaInboxTx(c.gp,c.atendimento.id,id,db).then(()=>{ending={sucesso:true};return {sucesso:true as const};},(erro:unknown)=>{ending={sucesso:false,...erroCuradoGP(erro)};return {erro};}).finally(()=>{terminou=true;fase("worker.ended");});
  worker=await antesDeFimGP(prontoPid,op);expect(new Set([worker,holder,observer]).size).toBe(3);
  const limite=Date.now()+2000;let esperando=false;
  while(Date.now()<limite){
   if(terminou)throw new Error("Worker GP terminou antes da espera real no pai");
   await o.query("SELECT pg_stat_clear_snapshot()");
   const r=await o.query<{state:string;wait_event_type:string;wait_event:string;query:string;bloqueadores:number[]}>("SELECT state,wait_event_type,wait_event,query,pg_blocking_pids(pid) bloqueadores FROM pg_stat_activity WHERE pid=$1 AND datname=current_database()",[worker]);const row=r.rows[0];
   const flags={select:/\bSELECT\b/i.test(row?.query??""),parent:row?.query.includes('"AtendimentoWhatsApp"')??false,share:row?.query.includes("FOR SHARE")??false};
   samples.push({ms:Date.now()-inicio,worker,holder,observer,state:row?.state??null,waitType:row?.wait_event_type??null,waitEvent:row?.wait_event??null,knownBlockers:row?.bloqueadores??[],flags,fase:timeline.at(-1)?.fase??null});if(samples.length>30)samples.shift();
   if(row?.state==="active"&&row.wait_event_type==="Lock"&&["transactionid","tuple"].includes(row.wait_event)&&flags.select&&flags.parent&&flags.share&&row.bloqueadores.includes(holder)){esperando=true;break;}
   await new Promise(r=>setTimeout(r,20));
  }
  expect(esperando,JSON.stringify(samples.slice(-5))).toBe(true);expect(timeline.at(-1)?.fase).toBe("before.parent.SHARE");
  if(qual==="responsavel")await h.query('UPDATE "AtendimentoWhatsApp" SET "responsavelId"=NULL WHERE id=$1',[c.atendimento.id]);
  else if(qual==="ativo")await h.query('UPDATE "Usuario" SET ativo=false WHERE id=$1',[c.gp.id]);
  else await h.query('UPDATE "Usuario" SET papeis=ARRAY[\'PROFESSOR\']::"Papel"[] WHERE id=$1',[c.gp.id]);
  await h.query("COMMIT");holderCommit=true;fase("holder.revocation.committed");
  await antesDeFimGP(paiAdquirido,op);expect(terminou).toBe(false);expect(timeline.at(-1)?.fase).toBe("after.parent.SHARE.pause");
  await o.query("SELECT 1");await new Promise(r=>setTimeout(r,100));expect(avisos).toHaveLength(qual==="responsavel"?1:0);baseline=avisos.length;
  soltar();const resultado=await op;expect(resultado).toHaveProperty("erro");if(!("erro" in resultado))throw new Error("CancelGP revogado foi aceito");
  expect(erroCuradoGP(resultado.erro)).toMatchObject({code:null,sqlState:null});
  if(qual==="papel"){expect(resultado.erro).toBeInstanceOf(ErroPermissao);expect((resultado.erro as Error).message).toBe("Você não tem acesso a esta função do CRM.");}
  else {expect(resultado.erro).toBeInstanceOf(ErroRegra);expect((resultado.erro as Error).message).toBe(qual==="ativo"?"Sua sessão não está mais ativa.":"Mensagem agendada não encontrada ou sem permissão para cancelar.");}
  expect(holderCommit).toBe(true);expect(await prisma.intencaoMensagem.findUniqueOrThrow({where:{id}})).toMatchObject({status:"PENDENTE",autorId:c.gp.id,origem:"HUMANO"});
  expect(await prisma.evento.count({where:{agregadoId:c.atendimento.id,tipo:"MensagemAgendadaCancelada"}})).toBe(0);
  await o.query("SELECT 1");await new Promise(r=>setTimeout(r,100));delta=avisos.length-baseline;expect(delta).toBe(0);expect(falhas).toEqual([]);
 }catch(erro){primario=erro;throw erro;}finally{
  soltar();const fim=await Promise.allSettled([...(h?[finalizarHolderGP(h)]:[]),...(o?[o.end()]:[])]);cleanup=fim.map(x=>x.status);const erros=fim.flatMap(x=>x.status==="rejected"?[x.reason]:[]);
  if(op){const workerFim=await Promise.allSettled([op]);erros.push(...workerFim.flatMap(x=>x.status==="rejected"?[x.reason]:[]));}
  try{const dir=await mkdtemp(join(tmpdir(),"inbox362-gpcancel-revogacao-"));const path=join(dir,"curated.json");await writeFile(path,JSON.stringify({qual,worker,holder,observer,holderCommit,timeline,samples,terminou,ending,baselineAntesTentativa:baseline??null,avisosDepois:avisos.length,deltaTentativa:delta??null,falhas,cleanup,primary:primario?erroCuradoGP(primario):null},null,2));console.info("Evidência revogação GP362:",path);}catch(erro){erros.push(erro);}
  if(erros.length)throw new AggregateError([...(primario?[primario]:[]),...erros],"GP revogação erro/cleanup");
 }
}
it("aceite GP perde responsabilidade durante espera real no pai e cancelar recusa sem efeito",async()=>{
 const c=await pedagogico(),id=idDe(await agendarMensagemNoAtendimento({atendimentoId:c.atendimento.id,texto:"GP revogação responsabilidade",quando:diaUtilAs(10,"America/Costa_Rica").toISOString()}));
 await revogarDuranteCancelGP(c,id,"responsavel");
});
it("aceite GP perde ativo ou papel durante espera real no pai e cancelar recusa sem efeito",async()=>{
 const c=await pedagogico(),id=idDe(await agendarMensagemNoAtendimento({atendimentoId:c.atendimento.id,texto:"GP revogação ator",quando:diaUtilAs(10,"America/Costa_Rica").toISOString()}));
 await revogarDuranteCancelGP(c,id,"ativo");
 await prisma.usuario.update({where:{id:c.gp.id},data:{ativo:true,papeis:[Papel.GERENTE_PEDAGOGICO]}});
 await revogarDuranteCancelGP(c,id,"papel");
});
