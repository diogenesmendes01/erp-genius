import { expect,it,vi } from "vitest";
import { Papel,PrismaClient } from "@prisma/client";
import { resolverBancoTeste } from "../../../scripts/test-profile.mjs";
const sessao=vi.hoisted(()=>({usuarioId:""}));
vi.mock("@/server/_shared/sessao",async original=>{const real=await original<typeof import("@/server/_shared/sessao")>();return {...real,exigirSessao:async()=>{const u=await real.carregarUsuarioFresco(sessao.usuarioId);if(!u)throw new real.ErroAutenticacao();return u;}};});
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import { prisma } from "@/lib/prisma";
import { criarUsuario,seedCatalogoMinimo,truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";
import { criarTarefa } from "@/server/crm/tarefas";
import { aprovarSugestaoNoInbox } from "./decisao-inbox";
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});return {promise,resolve};}
type Espera={pid:number;state:string;wait_event_type:string|null;wait_event:string|null;blockers:number[]};
const snapshots:{rotulo:string;rows:Espera[]}[]=[],erros:{name:string;code:string|null;sqlState:string|null}[]=[];
const barreira=deferred(),liberar=deferred();let ativada=false;
const LOCKS_EXATOS=new Set(['SELECT id FROM "AtendimentoWhatsApp" WHERE id=$1 FOR UPDATE','SELECT id FROM "AtendimentoWhatsApp" WHERE id=$1 FOR NO KEY UPDATE']);
prisma.$use(async(params,next)=>{
 try{
  const r=await next(params),a=params.args;
  const q=typeof a?.query==="string"?a.query:typeof a?.text==="string"?a.text:typeof a?.sql==="string"?a.sql:Array.isArray(a)?(a[0]?.text??a[0]?.sql??a[0]?.join?.("$1")??""):"";
  if(ativada&&params.action==="queryRaw"&&LOCKS_EXATOS.has(q.replace(/\s+/g," ").trim())){ativada=false;barreira.resolve();await liberar.promise;}
  return r;
 }catch(e){const erro=e as {name?:string;code?:string;meta?:{code?:string};message?:string};erros.push({name:erro.name??"Error",code:erro.code??null,sqlState:erro.meta?.code??erro.message?.match(/\b40P01\b/)?.[0]??null});throw e;}
});
it("354: criarTarefa global com Lead+Atendimento e decisão Inbox concluem uma vez sem ciclo de FKs",async()=>{
 const alvo=resolverBancoTeste();const url=new URL(process.env.DATABASE_URL!);expect(url.pathname).toBe('/'+alvo.banco);url.searchParams.set("connection_limit","1");
 const observer=new PrismaClient({datasources:{db:{url:url.toString()}}});
 let wrapper:ReturnType<typeof aprovarSugestaoNoInbox>|undefined,crm:ReturnType<typeof criarTarefa>|undefined;
 let crmConcluiu=false,wrapperConcluiu=false;
 try{
  await truncarBanco();const cat=await seedCatalogoMinimo();
  await prisma.configuracaoOperacional.upsert({where:{id:"escola"},create:{id:"escola",fusoInstitucional:"UTC"},update:{fusoInstitucional:"UTC"}});
  const vendedor=await criarUsuario([Papel.VENDEDOR],"Causal vendedor");sessao.usuarioId=vendedor.id;
  const {numero}=await seedCanal({estado:"ATIVA"});const pessoa=await prisma.pessoa.create({data:{nome:"Causal fictícia"}});
  const lead=await prisma.oportunidade.create({data:{nome:"Causal fictícia",vendedorDonoId:vendedor.id,pessoaId:pessoa.id,paisId:cat.pais.id}});
  const contato=await prisma.contatoWhatsApp.create({data:{telefoneE164:"+50680003540",leadId:lead.id}});
  const at=await prisma.$transaction(tx=>garantirAtendimento(tx,{numeroId:numero.id,contatoId:contato.id,finalidade:"COMERCIAL",leadId:lead.id,responsavelId:vendedor.id}));
  const ancora=await prisma.mensagemWhatsApp.create({data:{atendimentoId:at.id,conversaId:at.conversaId,numeroId:numero.id,direcao:"ENTRADA",corpo:"oi",driver:"MOTOR",status:"ENTREGUE",providerMessageId:"causal354"}});
  const turno=await prisma.turnoAgenteIA.create({data:{ancoraMensagemId:ancora.id,atendimentoId:at.id,tipo:"ATENDIMENTO",resultado:"EM_ANDAMENTO"}});
  const tag=await prisma.tag.create({data:{nome:"Causal",cor:"INFO"}});
  const acao=await prisma.acaoAgenteIA.create({data:{turnoId:turno.id,atendimentoId:at.id,oportunidadeId:lead.id,acao:"TAG",modoConfigurado:"SUGERE",status:"SUGERIDA",confianca:90,payload:{pessoaId:pessoa.id,tagId:tag.id,nome:tag.nome},reversivel:true}});
  const snapshot=()=>observer.$queryRaw<Espera[]>`SELECT pid,state,wait_event_type,wait_event,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() ORDER BY pid`;
  async function esperar<T>(condicao:(rows:Espera[])=>T|false|undefined,rotulo:string):Promise<T>{const limite=Date.now()+1800;while(Date.now()<limite){const rows=await snapshot(),r=condicao(rows);if(r){snapshots.push({rotulo,rows});return r;}await new Promise<void>(r=>setImmediate(r));}throw Error("Condição causal não observada: "+rotulo);}
  ativada=true;wrapper=aprovarSugestaoNoInbox(at.id,acao.id).finally(()=>{wrapperConcluiu=true;});
  await Promise.race([barreira.promise,new Promise((_,reject)=>setTimeout(()=>reject(Error("Barreira pós-lock não atingida")),2000))]);
  const pidWrapper=await esperar<number>(rows=>rows.find(r=>r.state==="idle in transaction"&&r.wait_event_type==="Client")?.pid,"wrapper após lock real");
  crm=criarTarefa({titulo:"Causal FK354",tipo:"OUTRO",leadId:lead.id,pessoaId:pessoa.id,atendimentoId:at.id}).finally(()=>{crmConcluiu=true;});
  await esperar(rows=>crmConcluiu||rows.some(r=>r.wait_event_type==="Lock"&&r.blockers.includes(pidWrapper)),"CRM concluiu ou bloqueou no Atendimento");
  liberar.resolve();
  while(!crmConcluiu||!wrapperConcluiu){const rows=await snapshot();if(rows.some(w=>w.pid===pidWrapper&&w.wait_event_type==="Lock"&&rows.some(g=>g.pid!==pidWrapper&&g.blockers.includes(pidWrapper)&&w.blockers.includes(g.pid)))){snapshots.push({rotulo:"ciclo bilateral oportunístico",rows});break;}await new Promise<void>(r=>setImmediate(r));}
  const [rw,rc]=await Promise.all([wrapper,crm]);
  const persistido={tarefas:await prisma.tarefa.count({where:{titulo:"Causal FK354"}}),tarefaEventos:await prisma.evento.count({where:{tipo:"TarefaCriada",agregadoTipo:"Tarefa"}}),tags:await prisma.pessoaTag.count({where:{pessoaId:pessoa.id}}),aprovacaoEventos:await prisma.evento.count({where:{tipo:"AcaoAriaAprovada",agregadoId:acao.id}}),status:(await prisma.acaoAgenteIA.findUniqueOrThrow({where:{id:acao.id}})).status};
  console.info("354-fk-native",JSON.stringify({snapshots,erros,resultados:{wrapper:rw,crm:rc},persistido}));
  expect(persistido.tarefas).toBe(rc.ok?1:0);expect(persistido.tarefaEventos).toBe(rc.ok?1:0);expect(persistido.tags).toBe(rw.ok?1:0);expect(persistido.aprovacaoEventos).toBe(rw.ok?1:0);
  expect(rw.ok&&rc.ok).toBe(true);
  expect(erros.some(e=>e.sqlState==="40P01"||e.code==="P2034")).toBe(false);
  expect(persistido).toMatchObject({tarefas:1,tarefaEventos:1,tags:1,aprovacaoEventos:1,status:"APROVADA"});
 }finally{ativada=false;liberar.resolve();await Promise.allSettled([wrapper,crm]);await observer.$disconnect();}
},30000);
