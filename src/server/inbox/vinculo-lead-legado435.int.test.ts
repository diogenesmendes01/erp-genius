import {garantirAtendimento} from "@/server/whatsapp/atendimentos";
import * as registro from "@/server/_shared/evento";
import {afterAll,afterEach,beforeEach,expect,it,vi} from "vitest";
import {Papel,PrismaClient,type FinalidadeNumero} from "@prisma/client";
const sessao=vi.hoisted(()=>({id:""}));
vi.mock("@/server/_shared/sessao",async original=>{const real=await original<typeof import("@/server/_shared/sessao")>();return {...real,exigirSessao:async()=>{const u=await real.carregarUsuarioFresco(sessao.id);if(!u)throw new real.ErroAutenticacao();return u;}};});
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {prisma} from "@/lib/prisma";
import {criarUsuario,criarAlunoMinimo,seedCatalogoMinimo,truncarBanco} from "@/test/integracao";
import {vincularContatoWhatsApp} from "@/server/whatsapp/acoes";
beforeEach(()=>truncarBanco());afterEach(()=>vi.restoreAllMocks());afterAll(()=>prisma.$disconnect());
let seq=0;
async function cenario(finalidade:FinalidadeNumero="VENDAS"){
 const u=await criarUsuario([Papel.VENDEDOR]),n=++seq;sessao.id=u.id;
 const pessoa=await prisma.pessoa.create({data:{nome:"Pessoa antiga fictícia"}}),outra=await prisma.pessoa.create({data:{nome:"Pessoa do lead fictícia"}});
 const telefone="+550004350"+n,lead=await prisma.oportunidade.create({data:{nome:"Alvo legado435",telefoneE164:telefone,pessoaId:outra.id,vendedorDonoId:u.id}});
 const anterior=await prisma.oportunidade.create({data:{nome:"Anterior435",telefoneE164:telefone,vendedorDonoId:u.id}});
 const contato=await prisma.contatoWhatsApp.create({data:{telefoneE164:telefone,pessoaId:pessoa.id}});
 const numero=await prisma.numeroWhatsApp.create({data:{telefoneE164:"+550014350"+n,rotulo:"Legado fictício435",driver:"MOTOR",finalidade,donoId:u.id}});
 await prisma.numeroSetorWhatsApp.create({data:{numeroId:numero.id,finalidade:"COMERCIAL"}});
 const conversa=await prisma.conversaWhatsApp.create({data:{numeroId:numero.id,contatoId:contato.id}});
 const a=await prisma.atendimentoWhatsApp.create({data:{conversaId:conversa.id,finalidade:"COMERCIAL",contextoChave:finalidade==="VENDAS"?"COMERCIAL:LINHA":"COMERCIAL:"+anterior.id+"::",leadId:finalidade==="VENDAS"?null:anterior.id}});
 const input={contatoId:contato.id,atendimentoId:a.id,alvo:{tipo:"lead" as const,id:lead.id}};
 return{u,pessoa,outra,lead,anterior,contato,numero,conversa,a,input};
}
it("AcoesContato legado vendedor institucional mantém contexto anterior e cria contexto do lead",async()=>{
 const c=await cenario("AGENDA");expect(await vincularContatoWhatsApp(c.input)).toEqual({ok:true});
 expect((await prisma.contatoWhatsApp.findUniqueOrThrow({where:{id:c.contato.id}})).leadId).toBe(c.lead.id);
 expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.a.id}})).leadId).toBe(c.anterior.id);
 expect(await prisma.atendimentoWhatsApp.findMany({where:{conversaId:c.conversa.id,contextoChave:"COMERCIAL:"+c.lead.id+"::"}})).toHaveLength(1);
});
it("AcoesContato legado permite Pessoa divergente sem alterar identidade de Pessoa",async()=>{
 const c=await cenario();expect(await vincularContatoWhatsApp(c.input)).toEqual({ok:true});expect(await prisma.contatoWhatsApp.findUniqueOrThrow({where:{id:c.contato.id}})).toMatchObject({leadId:c.lead.id,pessoaId:c.pessoa.id});expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.a.id}})).leadId).toBe(c.lead.id);
});
it("AcoesContato legado selected de outro lead não sobrescreve histórico",async()=>{
 const c=await cenario();await prisma.atendimentoWhatsApp.update({where:{id:c.a.id},data:{leadId:c.anterior.id}});expect(await vincularContatoWhatsApp(c.input)).toEqual({ok:true});expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.a.id}})).leadId).toBe(c.anterior.id);expect(await prisma.atendimentoWhatsApp.count({where:{conversaId:c.conversa.id,leadId:c.lead.id}})).toBe(1);
});
it("AcoesContato legado preenche candidato da linha mesmo selecionado outro contexto",async()=>{
 const c=await cenario();await prisma.contatoWhatsApp.update({where:{id:c.contato.id},data:{pessoaId:c.outra.id}});await prisma.atendimentoWhatsApp.update({where:{id:c.a.id},data:{contextoChave:"COMERCIAL:::"}});const candidato=await prisma.atendimentoWhatsApp.create({data:{conversaId:c.conversa.id,finalidade:"COMERCIAL",contextoChave:"COMERCIAL:LINHA"}});expect(await vincularContatoWhatsApp(c.input)).toEqual({ok:true});expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.a.id}})).leadId).toBeNull();expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:candidato.id}})).leadId).toBe(c.lead.id);
});
it.each(["telefone","carteira","contato vinculado"])("legado ainda recusa %s sem Evento",async caso=>{
 const c=await cenario();if(caso==="telefone")await prisma.oportunidade.update({where:{id:c.lead.id},data:{telefoneE164:"+550004359999"}});else if(caso==="carteira")await prisma.oportunidade.update({where:{id:c.lead.id},data:{vendedorDonoId:(await criarUsuario([Papel.VENDEDOR])).id}});else await prisma.contatoWhatsApp.update({where:{id:c.contato.id},data:{leadId:c.anterior.id}});
 expect((await vincularContatoWhatsApp(c.input)).ok).toBe(false);expect(await prisma.evento.count({where:{tipo:"ContatoVinculado"}})).toBe(0);
});
it("falha de Evento após escrita real reverte contato e novo contexto institucional",async()=>{
 const c=await cenario("AGENDA"),real=registro.registrarEvento,log=vi.spyOn(console,"error").mockImplementation(()=>{});
 const spy=vi.spyOn(registro,"registrarEvento").mockImplementation(async(...args)=>{await real(...args);throw Error("rollback legado435");});
 expect((await vincularContatoWhatsApp(c.input)).ok).toBe(false);expect(spy).toHaveBeenCalledOnce();
 expect((await prisma.contatoWhatsApp.findUniqueOrThrow({where:{id:c.contato.id}})).leadId).toBeNull();expect(await prisma.atendimentoWhatsApp.count({where:{conversaId:c.conversa.id}})).toBe(1);expect(await prisma.evento.count({where:{tipo:"ContatoVinculado"}})).toBe(0);log.mockRestore();
});
it.each(["papel revogado","carteira revogada","novo candidato"])("legado revalida após espera SQL real: %s",async caso=>{
 const c=await cenario(),outro=await criarUsuario([Papel.VENDEDOR]),holder=new PrismaClient();let pronto!:()=>void,liberar!:()=>void;const pronta=new Promise<void>(r=>pronto=r),livre=new Promise<void>(r=>liberar=r);let trava:Promise<unknown>|undefined,tentativa:ReturnType<typeof vincularContatoWhatsApp>|undefined;
 try{trava=holder.$transaction(async tx=>{
  if(caso==="carteira revogada")await tx.$queryRaw`SELECT id FROM "Lead" WHERE id=${c.lead.id} FOR UPDATE`;else await tx.$queryRaw`SELECT id FROM "ContatoWhatsApp" WHERE id=${c.contato.id} FOR UPDATE`;
  pronto();await livre;
  if(caso==="papel revogado")await tx.usuario.update({where:{id:c.u.id},data:{papeis:[Papel.PROFESSOR]}});
  else if(caso==="carteira revogada")await tx.oportunidade.update({where:{id:c.lead.id},data:{vendedorDonoId:outro.id}});
  else await tx.atendimentoWhatsApp.create({data:{conversaId:c.conversa.id,contextoChave:"COMERCIAL:"+c.lead.id+"::",finalidade:"COMERCIAL",leadId:c.lead.id}});
 },{timeout:20000});await pronta;tentativa=vincularContatoWhatsApp(c.input);
 await vi.waitFor(async()=>{const r=await prisma.$queryRaw<{n:bigint}[]>`SELECT count(*) n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FOR UPDATE%'`;expect(Number(r[0].n)).toBeGreaterThan(0);});
 liberar();await trava;expect((await tentativa).ok).toBe(false);expect((await prisma.contatoWhatsApp.findUniqueOrThrow({where:{id:c.contato.id}})).leadId).toBeNull();expect(await prisma.evento.count({where:{tipo:"ContatoVinculado"}})).toBe(0);
 }finally{liberar?.();await trava?.catch(()=>{});await tentativa?.catch(()=>{});await holder.$disconnect();}
});
it("duas vinculações legadas reais em selecteds distintos não sobrescrevem contato",async()=>{
 const c=await cenario(),outro=await prisma.oportunidade.create({data:{nome:"Segundo435",telefoneE164:c.contato.telefoneE164,vendedorDonoId:c.u.id}}),segundo=await prisma.atendimentoWhatsApp.create({data:{conversaId:c.conversa.id,contextoChave:"COMERCIAL:LEGADO435",finalidade:"COMERCIAL"}});
 const holder=new PrismaClient();let pronto!:()=>void,liberar!:()=>void;const pronta=new Promise<void>(r=>pronto=r),livre=new Promise<void>(r=>liberar=r);let trava:Promise<unknown>|undefined,tentativas:Promise<Awaited<ReturnType<typeof vincularContatoWhatsApp>>[]>|undefined;
 try{const ultimo=[c.a.id,segundo.id].sort().at(-1)!;trava=holder.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${ultimo} FOR UPDATE`;pronto();await livre;},{timeout:20000});await pronta;
 tentativas=Promise.all([vincularContatoWhatsApp(c.input),vincularContatoWhatsApp({...c.input,atendimentoId:segundo.id,alvo:{tipo:"lead",id:outro.id}})]);
 await vi.waitFor(async()=>{const r=await prisma.$queryRaw<{n:bigint}[]>`SELECT count(*) n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FOR UPDATE%'`;expect(Number(r[0].n)).toBeGreaterThanOrEqual(2);});liberar();await trava;const rs=await tentativas;expect(rs.filter(r=>r.ok)).toHaveLength(1);expect(await prisma.evento.count({where:{tipo:"ContatoVinculado"}})).toBe(1);expect([c.lead.id,outro.id]).toContain((await prisma.contatoWhatsApp.findUniqueOrThrow({where:{id:c.contato.id}})).leadId);
 }finally{liberar?.();await trava?.catch(()=>{});await tentativas?.catch(()=>{});await holder.$disconnect();}
});
it.each(["atendimento inexistente","contato diferente"])("recusa de alcance mantém mensagem legada: %s",async caso=>{
 const c=await cenario();const r=await vincularContatoWhatsApp({...c.input,...(caso==="atendimento inexistente"?{atendimentoId:"inexistente435"}:{contatoId:"outro-contato435"})});
 expect(r).toEqual({ok:false,erro:"Atendimento fora do seu escopo para vinculação."});expect(await prisma.evento.count({where:{tipo:"ContatoVinculado"}})).toBe(0);
});
async function comAlunoTurma(finalidade:FinalidadeNumero){
 const c=await cenario(finalidade),cat=await seedCatalogoMinimo(),nivel=await prisma.nivel.create({data:{idiomaId:cat.idioma.id,codigo:"A1",ordem:1}}),turma=await prisma.turma.create({data:{modalidadeId:cat.modalidade.id,nivelId:nivel.id,nome:"Turma legada435"}}),aluno=await criarAlunoMinimo({telefoneE164:c.contato.telefoneE164});
 await prisma.atendimentoWhatsApp.update({where:{id:c.a.id},data:{leadId:c.anterior.id,alunoId:aluno.id,turmaId:turma.id}});
 return{...c,aluno,turma,contexto:["COMERCIAL",c.lead.id,aluno.id,turma.id].join(":")};
}
it.each(["AGENDA","VENDAS"] as const)("controle histórico garantirAtendimento preserva aluno e turma no contexto %s",async finalidade=>{
 const c=await comAlunoTurma(finalidade),a=await prisma.$transaction(tx=>garantirAtendimento(tx,{numeroId:c.numero.id,contatoId:c.contato.id,finalidade:"COMERCIAL",leadId:c.lead.id,alunoId:c.aluno.id,turmaId:c.turma.id}));expect(a).toMatchObject({contextoChave:c.contexto,leadId:c.lead.id,alunoId:c.aluno.id,turmaId:c.turma.id});
});
it.each(["AGENDA","VENDAS"] as const)("ação legada preserva aluno e turma no contexto %s",async finalidade=>{
 const c=await comAlunoTurma(finalidade);expect(await vincularContatoWhatsApp(c.input)).toEqual({ok:true});
 const novo=await prisma.atendimentoWhatsApp.findUnique({where:{conversaId_contextoChave:{conversaId:c.conversa.id,contextoChave:c.contexto}}});expect(novo).toMatchObject({leadId:c.lead.id,alunoId:c.aluno.id,turmaId:c.turma.id});
 expect(await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.a.id}})).toMatchObject({leadId:c.anterior.id,alunoId:c.aluno.id,turmaId:c.turma.id});
});