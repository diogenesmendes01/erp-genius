import {Client} from "pg";
import {CANAL_INBOX} from "./barramento";
import {PrismaClient,Papel,type Prisma} from "@prisma/client";
import {beforeEach,afterAll,expect,it,vi} from "vitest";
const {authMock}=vi.hoisted(()=>({authMock:vi.fn()}));
vi.mock("@/server/_shared/sessao",async original=>{const real=await original<typeof import("@/server/_shared/sessao")>();return {...real,exigirSessao:async()=>{const s=await authMock();const u=await real.carregarUsuarioFresco(s.user.id);if(!u)throw new real.ErroAutenticacao();return u;}};});
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {prisma} from "@/lib/prisma";
import {criarUsuario,truncarBanco} from "@/test/integracao";
import {cenarioPerda328} from "@/test/inbox-perda";
import {dadosModalTarefaNoInbox,criarTarefaNoInbox,editarTarefaNoInbox,cancelarTarefaNoInbox,concluirTarefaNoInbox} from "./acoes-painel";
import {criarNumeroSetor} from "@/test/integracao-whatsapp";
import {garantirAtendimento} from "@/server/whatsapp/atendimentos";
import {valorCampoLocal} from "@/server/operacao/fuso-entrada";
import {diaUtilAs} from "@/test/janela-envio";
import * as aviso from "./aviso";
beforeEach(async()=>{vi.restoreAllMocks();await truncarBanco();});
afterAll(()=>prisma.$disconnect());
async function cenario(){const c=await cenarioPerda328();authMock.mockResolvedValue({user:{id:c.dono.id}});await prisma.configuracaoOperacional.upsert({where:{id:"escola"},create:{id:"escola",fusoInstitucional:"America/Sao_Paulo"},update:{fusoInstitucional:"America/Sao_Paulo"}});return c;}
async function entrada(id:string){const r=await dadosModalTarefaNoInbox(id);if(!r.ok||!r.dado)throw new Error(JSON.stringify(r));return {titulo:"Retornar",tipo:"WHATSAPP" as const,dataCivil:null,hora:null,vincularOportunidade:true,jaFeita:true,chaveIdempotencia:"331-criacao-tentativa-0001",contextoEsperado:r.dado.contextoEsperado,fusoEscolaEsperado:r.dado.fusoEscola};}
it("cria e conclui atomicamente, replay não duplica Eventos nem aviso",async()=>{const c=await cenario(),i=await entrada(c.a.id),a=vi.spyOn(aviso,"avisarAtendimento");const r=await criarTarefaNoInbox(c.a.id,i);expect(r.ok).toBe(true);if(!r.ok||!r.dado)throw new Error(JSON.stringify(r));expect(await prisma.tarefa.findUniqueOrThrow({where:{id:r.dado.id}})).toMatchObject({status:"CONCLUIDA",versao:2,atendimentoId:c.a.id,leadId:c.op.id,tipo:"WHATSAPP"});expect(await criarTarefaNoInbox(c.a.id,i)).toEqual(r);expect(await prisma.evento.count({where:{agregadoTipo:"Tarefa",agregadoId:r.dado.id}})).toBe(2);expect(a).toHaveBeenCalledOnce();expect((await criarTarefaNoInbox(c.a.id,{...i,jaFeita:false})).ok).toBe(false);});
it("falha no aviso reverte criação, conclusão e Eventos",async()=>{const c=await cenario(),i=await entrada(c.a.id);vi.spyOn(aviso,"avisarAtendimento").mockRejectedValueOnce(new Error("falha injetada331"));expect((await criarTarefaNoInbox(c.a.id,i)).ok).toBe(false);expect(await prisma.tarefa.count()).toBe(0);expect(await prisma.evento.count()).toBe(0);});
it("sem lead cria vínculo direto e exige título máximo200",async()=>{const c=await cenario();await prisma.atendimentoWhatsApp.update({where:{id:c.a.id},data:{leadId:null}});const i=await entrada(c.a.id);expect((await criarTarefaNoInbox(c.a.id,{...i,titulo:"x".repeat(201)})).ok).toBe(false);const r=await criarTarefaNoInbox(c.a.id,{...i,titulo:"x".repeat(200),vincularOportunidade:false,jaFeita:false});expect(r.ok).toBe(true);if(r.ok&&r.dado)expect(await prisma.tarefa.findUniqueOrThrow({where:{id:r.dado.id}})).toMatchObject({leadId:null,atendimentoId:c.a.id,status:"ABERTA"});});
it("edição manter preserva instante DST/duração e remover/vincularAtual são explícitos",async()=>{const c=await cenario(),i=await entrada(c.a.id);const t=await prisma.tarefa.create({data:{titulo:"Antes",tipo:"OUTRO",setor:"COMERCIAL",responsavelId:c.dono.id,criadorId:c.dono.id,atendimentoId:c.a.id,leadId:c.op.id,fusoOrigem:"America/New_York",duracaoMin:60,dataCivil:"2026-11-01",inicioEm:new Date("2026-11-01T05:30:00Z")}});const base={contextoEsperado:i.contextoEsperado,fusoEscolaEsperado:i.fusoEscolaEsperado};expect(await editarTarefaNoInbox(c.a.id,t.id,1,{...base,titulo:"Depois",vinculo:"manter",contextoEsperado:await identidade(c.a.id)})).toEqual({ok:true});expect(await prisma.tarefa.findUniqueOrThrow({where:{id:t.id}})).toMatchObject({titulo:"Depois",inicioEm:t.inicioEm,duracaoMin:60,leadId:c.op.id});expect(await editarTarefaNoInbox(c.a.id,t.id,2,{...base,vinculo:"remover"})).toEqual({ok:true});expect((await prisma.tarefa.findUniqueOrThrow({where:{id:t.id}})).leadId).toBeNull();expect(await editarTarefaNoInbox(c.a.id,t.id,3,{...base,vinculo:"vincularAtual"})).toEqual({ok:true});expect((await prisma.tarefa.findUniqueOrThrow({where:{id:t.id}})).leadId).toBe(c.op.id);});
it("contexto alterado recusa sem criar",async()=>{const c=await cenario(),i=await entrada(c.a.id);await prisma.atendimentoWhatsApp.update({where:{id:c.a.id},data:{leadId:null}});expect((await criarTarefaNoInbox(c.a.id,i)).ok).toBe(false);expect(await prisma.tarefa.count()).toBe(0);});
it("duas criações SQL simultâneas com mesma intenção retornam um único ID",async()=>{const c=await cenario(),i=await entrada(c.a.id);const rr=await Promise.all([criarTarefaNoInbox(c.a.id,i),criarTarefaNoInbox(c.a.id,i)]);expect(rr[0].ok).toBe(true);expect(rr[1]).toEqual(rr[0]);expect(await prisma.tarefa.count()).toBe(1);expect(await prisma.evento.count({where:{agregadoTipo:"Tarefa"}})).toBe(2);});
it("replay após cancelamento/edição não conclui novamente e perde acesso se autor revogado",async()=>{const c=await cenario(),i=await entrada(c.a.id),r=await criarTarefaNoInbox(c.a.id,{...i,jaFeita:false});if(!r.ok||!r.dado)throw new Error(JSON.stringify(r));await prisma.tarefa.update({where:{id:r.dado.id},data:{status:"CANCELADA",versao:9}});const total=await prisma.evento.count();expect(await criarTarefaNoInbox(c.a.id,{...i,jaFeita:false})).toEqual(r);expect((await prisma.tarefa.findUniqueOrThrow({where:{id:r.dado.id}})).status).toBe("CANCELADA");expect(await prisma.evento.count()).toBe(total);await prisma.usuario.update({where:{id:c.dono.id},data:{papeis:["PROFESSOR"]}});expect((await criarTarefaNoInbox(c.a.id,{...i,jaFeita:false})).ok).toBe(false);expect(await prisma.evento.count()).toBe(total);});
it("vincular recusa Pessoa incompatível, remover recusa vínculo de outro contexto",async()=>{const c=await cenario(),i=await entrada(c.a.id);const p=await prisma.pessoa.create({data:{nome:"Outra pessoa331"}}),outra=await prisma.oportunidade.create({data:{nome:"Outro contexto331",vendedorDonoId:c.dono.id}});const t=await prisma.tarefa.create({data:{titulo:"Direta",tipo:"OUTRO",setor:"COMERCIAL",responsavelId:c.dono.id,criadorId:c.dono.id,atendimentoId:c.a.id,pessoaId:p.id,fusoOrigem:"UTC"}});const b={contextoEsperado:i.contextoEsperado,fusoEscolaEsperado:i.fusoEscolaEsperado};expect((await editarTarefaNoInbox(c.a.id,t.id,1,{...b,vinculo:"vincularAtual"})).ok).toBe(false);await prisma.tarefa.update({where:{id:t.id},data:{leadId:outra.id}});expect((await editarTarefaNoInbox(c.a.id,t.id,1,{...b,vinculo:"remover"})).ok).toBe(false);expect(await editarTarefaNoInbox(c.a.id,t.id,1,{...b,vinculo:"manter",titulo:"Conservada",contextoEsperado:await identidade(c.a.id)})).toEqual({ok:true});expect(await prisma.tarefa.findUniqueOrThrow({where:{id:t.id}})).toMatchObject({pessoaId:p.id,leadId:outra.id,titulo:"Conservada"});});
it("agenda alterada no fuso escolar preserva origem e não rearma lembrete idêntico",async()=>{const c=await cenario(),i=await entrada(c.a.id);const inicioEm=new Date("2026-11-01T05:30:00Z"),lembrarEm=new Date("2026-11-01T05:00:00Z"),disparado=new Date("2026-11-01T05:01:00Z");const t=await prisma.tarefa.create({data:{titulo:"Agenda",tipo:"OUTRO",setor:"COMERCIAL",responsavelId:c.dono.id,criadorId:c.dono.id,atendimentoId:c.a.id,fusoOrigem:"America/New_York",dataCivil:"2026-11-01",inicioEm,lembreteAntecedenciaMin:30,lembrarEm,lembreteDisparadoEm:disparado}});const b={contextoEsperado:await identidade(c.a.id),fusoEscolaEsperado:i.fusoEscolaEsperado,vinculo:"manter" as const,dataCivil:"2026-11-01",hora:"02:30",lembreteAntecedenciaMin:30 as const};expect(await editarTarefaNoInbox(c.a.id,t.id,1,b)).toEqual({ok:true});expect(await prisma.tarefa.findUniqueOrThrow({where:{id:t.id}})).toMatchObject({inicioEm,lembrarEm,lembreteDisparadoEm:disparado,fusoOrigem:"America/New_York"});expect(await editarTarefaNoInbox(c.a.id,t.id,2,{...b,hora:"03:30"})).toEqual({ok:true});expect(await prisma.tarefa.findUniqueOrThrow({where:{id:t.id}})).toMatchObject({inicioEm:new Date("2026-11-01T06:30:00Z"),lembreteDisparadoEm:null,fusoOrigem:"America/New_York"});});
it("fuso esperado mudou e vínculo arbitrário recusam",async()=>{const c=await cenario(),i=await entrada(c.a.id);expect((await criarTarefaNoInbox(c.a.id,{...i,fusoEscolaEsperado:"UTC"})).ok).toBe(false);expect((await criarTarefaNoInbox(c.a.id,{...i,leadId:"arbitrario"} as typeof i)).ok).toBe(false);expect(await prisma.tarefa.count()).toBe(0);});

async function esperarBloqueadas(tx:Prisma.TransactionClient,minimo:number){for(let n=0;n<150;n++){await tx.$executeRaw`SELECT pg_stat_clear_snapshot()`;const [r]=await tx.$queryRaw<{n:bigint}[]>`SELECT count(*) AS n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%AtendimentoWhatsApp%'`;if(Number(r.n)>=minimo)return;await new Promise(r=>setTimeout(r,10));}throw new Error("A tentativa não alcançou a barreira SQL do atendimento.");}
it.each(["papel","contexto"])("revalida %s depois de espera comprovada por pg_stat_activity",async caso=>{const c=await cenario(),i=await entrada(c.a.id),holder=new PrismaClient();let pronta!:()=>void,soltar!:()=>void;const pronto=new Promise<void>(r=>pronta=r),livre=new Promise<void>(r=>soltar=r);let tentativa:ReturnType<typeof criarTarefaNoInbox>|undefined,trava:Promise<unknown>|undefined;try{trava=holder.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${c.a.id} FOR UPDATE`;pronta();await esperarBloqueadas(tx,1);if(caso==="papel")await tx.usuario.update({where:{id:c.dono.id},data:{papeis:["PROFESSOR"]}});else await tx.atendimentoWhatsApp.update({where:{id:c.a.id},data:{leadId:null}});await livre;},{timeout:10000});await Promise.race([pronto,trava]);tentativa=criarTarefaNoInbox(c.a.id,i);await new Promise(r=>setTimeout(r,80));soltar();await trava;expect((await tentativa).ok).toBe(false);expect(await prisma.tarefa.count()).toBe(0);expect(await prisma.evento.count()).toBe(0);}finally{soltar();await Promise.allSettled([trava,tentativa]);await holder.$disconnect();}});


it("NOTIFY nativo aparece só no commit; replay e rollback após aviso não publicam",async()=>{
 const c=await cenario(),i=await entrada(c.a.id),client=new Client({connectionString:process.env.DATABASE_URL}),quadros:Record<string,unknown>[]=[];
 client.on("notification",n=>{if(n.channel===CANAL_INBOX&&n.payload)quadros.push(JSON.parse(n.payload));});await client.connect();await client.query("LISTEN "+CANAL_INBOX);
 try{
  const r=await criarTarefaNoInbox(c.a.id,i);expect(r.ok).toBe(true);expect(await criarTarefaNoInbox(c.a.id,i)).toEqual(r);
  const real=aviso.avisarAtendimento,spy=vi.spyOn(aviso,"avisarAtendimento").mockImplementation(async(...args)=>{await real(...args);throw Error("falha após NOTIFY331");}),log=vi.spyOn(console,"error").mockImplementation(()=>{});
  try{expect((await criarTarefaNoInbox(c.a.id,{...i,chaveIdempotencia:"331-notify-rollback-0001"})).ok).toBe(false);}finally{spy.mockRestore();log.mockRestore();}
  const sent=await prisma.atendimentoWhatsApp.create({data:{conversaId:c.conversa.id,contextoChave:"COMERCIAL::sentinela331",finalidade:"COMERCIAL"}});await aviso.avisarAtendimento(prisma,sent.id);
  await vi.waitFor(()=>expect(quadros.some(q=>q.atendimentoId===sent.id)).toBe(true));expect(quadros.filter(q=>q.atendimentoId===c.a.id)).toHaveLength(1);expect(await prisma.tarefa.count()).toBe(1);expect(await prisma.evento.count({where:{agregadoTipo:"Tarefa"}})).toBe(2);
 }finally{await client.end();}
});
it("título de tarefa direta autorizada preserva vínculo quando oportunidade está oculta",async()=>{const c=await cenario();const outro=await prisma.usuario.create({data:{nome:"Outro dono331",email:"outro331@example.test",papeis:["VENDEDOR"],ativo:true,senhaHash:"fixture-sem-login331"}});await prisma.oportunidade.update({where:{id:c.op.id},data:{vendedorDonoId:outro.id}});const t=await prisma.tarefa.create({data:{titulo:"Original",tipo:"OUTRO",setor:"COMERCIAL",responsavelId:c.dono.id,criadorId:c.dono.id,atendimentoId:c.a.id,leadId:c.op.id,fusoOrigem:"UTC"}});const d=await dadosModalTarefaNoInbox(c.a.id,t.id);expect(d.ok).toBe(true);if(!d.ok||!d.dado)throw new Error(JSON.stringify(d));expect(d.dado.oportunidade).toBeNull();expect(d.dado.tarefa?.podeAlterarVinculo).toBe(false);expect(await editarTarefaNoInbox(c.a.id,t.id,1,{titulo:"Editada",vinculo:"manter",contextoEsperado:d.dado.contextoIdentidadeEsperada,fusoEscolaEsperado:d.dado.fusoEscola})).toEqual({ok:true});expect((await prisma.tarefa.findUniqueOrThrow({where:{id:t.id}})).leadId).toBe(c.op.id);});


async function identidade(id:string){const r=await dadosModalTarefaNoInbox(id);if(!r.ok||!r.dado)throw new Error(JSON.stringify(r));return r.dado.contextoIdentidadeEsperada;}
it.each(["visibilidade","lead","pessoa"])("edição manter após espera SQL: %s",async caso=>{
 const c=await cenario(),t=await prisma.tarefa.create({data:{titulo:"Antes",tipo:"OUTRO",setor:"COMERCIAL",responsavelId:c.dono.id,criadorId:c.dono.id,atendimentoId:c.a.id,leadId:c.op.id,fusoOrigem:"America/New_York",duracaoMin:60,dataCivil:"2026-11-01",inicioEm:new Date("2026-11-01T05:30:00Z")}}),esperado=await identidade(c.a.id);
 const outro=await prisma.usuario.create({data:{nome:"Outro331",email:"barreira331@example.test",senhaHash:"fixture-sem-login331",papeis:["VENDEDOR"]}}),p=await prisma.pessoa.create({data:{nome:"Outra Pessoa331"}}),holder=new PrismaClient();
 let pronta!:()=>void,soltar!:()=>void;const pronto=new Promise<void>(r=>pronta=r),livre=new Promise<void>(r=>soltar=r);let tentativa:ReturnType<typeof editarTarefaNoInbox>|undefined,trava:Promise<unknown>|undefined;
 try{trava=holder.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${c.a.id} FOR UPDATE`;pronta();await esperarBloqueadas(tx,1);if(caso==="visibilidade")await tx.oportunidade.update({where:{id:c.op.id},data:{vendedorDonoId:outro.id}});else if(caso==="lead")await tx.atendimentoWhatsApp.update({where:{id:c.a.id},data:{leadId:null}});else await tx.contatoWhatsApp.update({where:{id:c.contato.id},data:{pessoaId:p.id}});await livre;},{timeout:10000});await Promise.race([pronto,trava]);tentativa=editarTarefaNoInbox(c.a.id,t.id,1,{titulo:"Depois",vinculo:"manter",contextoEsperado:esperado,fusoEscolaEsperado:"America/Sao_Paulo"});await new Promise(r=>setTimeout(r,80));soltar();await trava;expect((await tentativa).ok).toBe(caso==="visibilidade");expect(await prisma.tarefa.findUniqueOrThrow({where:{id:t.id}})).toMatchObject({titulo:caso==="visibilidade"?"Depois":"Antes",leadId:c.op.id,inicioEm:t.inicioEm,duracaoMin:60});}finally{soltar();await Promise.allSettled([trava,tentativa]);await holder.$disconnect();}
});

it.each(["editar","cancelar"])("CAS nativo após duas esperas: editar versus %s",async outra=>{
 const c=await cenario(),t=await prisma.tarefa.create({data:{titulo:"Antes",tipo:"OUTRO",setor:"COMERCIAL",responsavelId:c.dono.id,criadorId:c.dono.id,atendimentoId:c.a.id,fusoOrigem:"UTC"}}),esperado=await identidade(c.a.id),holder=new PrismaClient();
 let pronta!:()=>void,soltar!:()=>void;const pronto=new Promise<void>(r=>pronta=r),livre=new Promise<void>(r=>soltar=r);let a:ReturnType<typeof editarTarefaNoInbox>|undefined,b:ReturnType<typeof editarTarefaNoInbox>|undefined,trava:Promise<unknown>|undefined;
 const input={titulo:"Depois",vinculo:"manter" as const,contextoEsperado:esperado,fusoEscolaEsperado:"America/Sao_Paulo"};
 try{trava=holder.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${c.a.id} FOR UPDATE`;pronta();await esperarBloqueadas(tx,2);await livre;},{timeout:10000});await Promise.race([pronto,trava]);a=editarTarefaNoInbox(c.a.id,t.id,1,input);b=outra==="editar"?editarTarefaNoInbox(c.a.id,t.id,1,{...input,titulo:"Outra edição"}):cancelarTarefaNoInbox(c.a.id,t.id,1,"Pedido331");await new Promise(r=>setTimeout(r,80));soltar();await trava;const rr=await Promise.all([a,b]);expect(rr.filter(r=>r.ok)).toHaveLength(1);expect((await prisma.tarefa.findUniqueOrThrow({where:{id:t.id}})).versao).toBe(2);expect(await prisma.evento.count({where:{agregadoTipo:"Tarefa",agregadoId:t.id}})).toBe(1);}finally{soltar();await Promise.allSettled([trava,a,b]);await holder.$disconnect();}
});

async function cenarioMensagem(assumido=true){
 const vend=await criarUsuario([Papel.VENDEDOR],"Vend339");
 const numero=await criarNumeroSetor({telefoneE164:"+5511999990339",setores:["COMERCIAL"],donoId:vend.id});
 const contato=await prisma.contatoWhatsApp.create({data:{telefoneE164:"+50688880339"}});
 const op=await prisma.oportunidade.create({data:{nome:"Lead339",telefoneE164:contato.telefoneE164,vendedorDonoId:vend.id}});
 await prisma.contatoWhatsApp.update({where:{id:contato.id},data:{leadId:op.id}});
 const a=await prisma.$transaction(tx=>garantirAtendimento(tx,{numeroId:numero.id,contatoId:contato.id,finalidade:"COMERCIAL",leadId:op.id,responsavelId:assumido?vend.id:null}));
 await prisma.configuracaoOperacional.upsert({where:{id:"escola"},create:{id:"escola",fusoInstitucional:"America/Sao_Paulo"},update:{fusoInstitucional:"America/Sao_Paulo"}});
 authMock.mockResolvedValue({user:{id:vend.id}});
 return {vend,op,a};
}
async function entradaMensagem(id:string,quando:Date|null,extra:Record<string,unknown>={}){
 const r=await dadosModalTarefaNoInbox(id);if(!r.ok||!r.dado)throw new Error(JSON.stringify(r));
 const local=quando?valorCampoLocal(quando,"America/Sao_Paulo"):null;
 return {titulo:"Retornar proposta",tipo:"WHATSAPP" as const,dataCivil:local?.slice(0,10)??null,hora:local?.slice(11,16)??null,vincularOportunidade:true,jaFeita:false,chaveIdempotencia:"339-tarefa-tentativa-0001",contextoEsperado:r.dado.contextoEsperado,fusoEscolaEsperado:r.dado.fusoEscola,mensagem:{texto:"Oi, passando para lembrar da proposta.",chaveIdempotencia:"339-mensagem-tentativa-0001"},...extra};
}
it("mensagem_agendada_com_tarefaId: agenda no início da tarefa, ligada a ela, e replay não duplica",async()=>{
 const c=await cenarioMensagem(),quando=diaUtilAs(10);
 const d=await dadosModalTarefaNoInbox(c.a.id);expect(d.ok&&d.dado?.podeAgendarMensagem).toBe(true);
 const i=await entradaMensagem(c.a.id,quando),r=await criarTarefaNoInbox(c.a.id,i);
 if(!r.ok||!r.dado)throw new Error(JSON.stringify(r));
 const t=await prisma.tarefa.findUniqueOrThrow({where:{id:r.dado.id}});expect(t.inicioEm?.toISOString()).toBe(quando.toISOString());
 const intencoes=await prisma.intencaoMensagem.findMany({where:{atendimentoId:c.a.id}});
 expect(intencoes).toHaveLength(1);expect(intencoes[0]).toMatchObject({tarefaId:t.id,leadId:c.op.id,origem:"HUMANO",autorId:c.vend.id,status:"PENDENTE",perguntarSeResponder:true,corpoRenderizado:"Oi, passando para lembrar da proposta."});
 expect(intencoes[0].agendadaPara?.toISOString()).toBe(quando.toISOString());
 expect(await prisma.evento.findFirst({where:{tipo:"MensagemAgendada",agregadoId:c.a.id}})).toMatchObject({agregadoTipo:"AtendimentoWhatsApp",payload:expect.objectContaining({tarefaId:t.id,intencaoId:intencoes[0].id})});
 expect(await criarTarefaNoInbox(c.a.id,i)).toEqual(r);
 expect(await prisma.intencaoMensagem.count()).toBe(1);expect(await prisma.tarefa.count()).toBe(1);expect(await prisma.evento.count({where:{tipo:"MensagemAgendada"}})).toBe(1);
 expect((await criarTarefaNoInbox(c.a.id,{...i,mensagem:{...i.mensagem,texto:"Outro texto"}})).ok).toBe(false);
});
it("horario_passado_nao_agenda: sem data ou com horário passado cria só a tarefa",async()=>{
 const c=await cenarioMensagem();
 const passado=await criarTarefaNoInbox(c.a.id,await entradaMensagem(c.a.id,new Date(Date.now()-86_400_000)));expect(passado.ok).toBe(true);
 const semPrazo=await criarTarefaNoInbox(c.a.id,await entradaMensagem(c.a.id,null,{chaveIdempotencia:"339-tarefa-tentativa-0002",mensagem:{texto:"Sem prazo",chaveIdempotencia:"339-mensagem-tentativa-0002"}}));expect(semPrazo.ok).toBe(true);
 expect(await prisma.tarefa.count()).toBe(2);expect(await prisma.intencaoMensagem.count()).toBe(0);expect(await prisma.evento.count({where:{tipo:"MensagemAgendada"}})).toBe(0);
});
it("repetir_nao_agenda_duas_vezes: concluir a recorrente cria a próxima sem nova mensagem",async()=>{
 const c=await cenarioMensagem(),r=await criarTarefaNoInbox(c.a.id,await entradaMensagem(c.a.id,diaUtilAs(10),{recorrencia:"SEMANAL"}));
 if(!r.ok||!r.dado)throw new Error(JSON.stringify(r));
 const t=await prisma.tarefa.findUniqueOrThrow({where:{id:r.dado.id}});
 expect((await concluirTarefaNoInbox(c.a.id,t.id,t.versao)).ok).toBe(true);
 expect(await prisma.tarefa.count()).toBe(2);
 const intencoes=await prisma.intencaoMensagem.findMany();expect(intencoes).toHaveLength(1);expect(intencoes[0].tarefaId).toBe(t.id);
});
it("sem ter assumido a conversa recusa sem criar tarefa nem mensagem",async()=>{
 const c=await cenarioMensagem(false);
 const d=await dadosModalTarefaNoInbox(c.a.id);expect(d.ok&&d.dado?.podeAgendarMensagem).toBe(false);
 const r=await criarTarefaNoInbox(c.a.id,await entradaMensagem(c.a.id,diaUtilAs(10)));
 expect(r).toEqual({ok:false,erro:"Assuma a conversa para agendar a mensagem."});
 expect(await prisma.tarefa.count()).toBe(0);expect(await prisma.intencaoMensagem.count()).toBe(0);expect(await prisma.evento.count()).toBe(0);
});
it("tarefa já feita com mensagem é recusada",async()=>{
 const c=await cenarioMensagem(),r=await criarTarefaNoInbox(c.a.id,await entradaMensagem(c.a.id,diaUtilAs(10),{jaFeita:true}));
 expect(r.ok).toBe(false);expect(await prisma.tarefa.count()).toBe(0);expect(await prisma.intencaoMensagem.count()).toBe(0);
});
