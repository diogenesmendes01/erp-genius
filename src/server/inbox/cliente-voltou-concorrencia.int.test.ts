import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { Papel, type FinalidadeNumero, type Prisma } from "@prisma/client";
const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/server/_shared/sessao", async original => {
  const real = await original<typeof import("@/server/_shared/sessao")>();
  return { ...real, exigirSessao: async () => {
    const u = await real.carregarUsuarioFresco(sessao.usuarioId);
    if (!u) throw new real.ErroAutenticacao();
    return u;
  } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { desvincularContatoWhatsApp } from "@/server/whatsapp/desvincular-contato";
import { vincularContatoWhatsApp } from "@/server/whatsapp/acoes";

beforeEach(async () => { await truncarBanco(); sessao.usuarioId = ""; });
afterEach(() => vi.restoreAllMocks());
afterAll(() => prisma.$disconnect());
let seq = 0;
async function cenario(finalidade: FinalidadeNumero) {
  const admin = await criarUsuario([Papel.ADMINISTRADOR], "Administrador fictício329");
  sessao.usuarioId = admin.id;
  const pessoa = await prisma.pessoa.create({ data: { nome: "Retorno fictício329" } });
  const telefone = "+550009329" + (++seq);
  const lead = await prisma.oportunidade.create({ data: { nome: "Curso fictício329", pessoaId: pessoa.id, telefoneE164: telefone, vendedorDonoId: admin.id, etapa: "MATRICULADO" } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: telefone, pessoaId: pessoa.id } });
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+550008329" + seq, rotulo: "Canal fictício329", driver: "MOTOR", finalidade, donoId: admin.id, ativo: true } });
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: contato.id } });
  const selecionado = await prisma.atendimentoWhatsApp.create({ data: { conversaId: conversa.id, finalidade: "COMERCIAL", contextoChave: finalidade === "VENDAS" ? "COMERCIAL:LINHA" : "COMERCIAL:::" } });
  const input = { contatoId: contato.id, atendimentoId: selecionado.id, alvo: { tipo: "lead" as const, id: lead.id } };
  return { admin, pessoa, lead, contato, conversa, selecionado, input };
}
const eventos = (contatoId: string) => prisma.evento.findMany({ where: { tipo: "ContatoVinculado", agregadoTipo: "ContatoWhatsApp", agregadoId: contatoId } });

/** Espera observável no Postgres: não basta esperar uma duração arbitrária. */
async function aguardarBloqueadoPor(pid: number) {
  for (let i = 0; i < 150; i++) {
    const [r] = await prisma.$queryRaw<{ bloqueados: bigint }[]>`SELECT count(*) AS bloqueados FROM pg_stat_activity WHERE ${pid} = ANY(pg_blocking_pids(pid))`;
    if (Number(r.bloqueados) > 0) return;
    await new Promise(r => setTimeout(r, 20));
  }
  throw new Error("A ACTION não chegou à barreira SQL esperada.");
}

async function tentarAposEspera(mudar: (tx: Prisma.TransactionClient, c: Awaited<ReturnType<typeof cenario>>) => Promise<unknown>, preparar?: (c: Awaited<ReturnType<typeof cenario>>) => Promise<unknown>, esperaLead = false) {
 const c=await cenario("VENDAS");
 await prisma.usuario.update({where:{id:c.admin.id},data:{papeis:[Papel.VENDEDOR]}});
 await preparar?.(c);
 let entrou!:(pid:number)=>void, soltar!:()=>void;
 const pronta=new Promise<number>(r=>{entrou=r;}), liberar=new Promise<void>(r=>{soltar=r;});
 const bloqueadora=prisma.$transaction(async tx=>{
  const [p]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() AS pid`;
  if (esperaLead) await tx.$queryRaw`SELECT id FROM "Lead" WHERE id=${c.lead.id} FOR UPDATE`;
  else await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${c.selecionado.id} FOR UPDATE`;
  entrou(p.pid);await liberar;await mudar(tx,c);
 },{timeout:20000});
 const pid=await pronta, acao=vincularContatoWhatsApp(c.input);
 try{await aguardarBloqueadoPor(pid);}finally{soltar();await bloqueadora;}
 expect((await acao).ok).toBe(false);
 expect((await prisma.contatoWhatsApp.findUniqueOrThrow({where:{id:c.contato.id}})).leadId).toBeNull();
 expect(await eventos(c.contato.id)).toHaveLength(0);
}
it("telefone alterado durante espera SQL é relido",()=>tentarAposEspera((tx,c)=>tx.contatoWhatsApp.update({where:{id:c.contato.id},data:{telefoneE164:"+550000999329"}})));
it("papéis revogados durante espera SQL são relidos",()=>tentarAposEspera((tx,c)=>tx.usuario.update({where:{id:c.admin.id},data:{papeis:[Papel.PROFESSOR]}})));
it("ator inativado durante espera SQL é recusado",()=>tentarAposEspera((tx,c)=>tx.usuario.update({where:{id:c.admin.id},data:{ativo:false}})));
it("carteira alterada durante espera SQL é relida",()=>tentarAposEspera(async(tx,c)=>{
 const outro=await tx.usuario.create({data:{nome:"Outro dono fictício329",email:"outro329@example.test",senhaHash:"x",papeis:[Papel.VENDEDOR]}});
 return tx.oportunidade.update({where:{id:c.lead.id},data:{vendedorDonoId:outro.id}});
}));
it("convite de escrita revogado durante espera SQL é relido",()=>tentarAposEspera(async(tx,c)=>{
 return tx.participanteAtendimentoWhatsApp.updateMany({where:{atendimentoId:c.selecionado.id,usuarioId:c.admin.id},data:{revogadoEm:new Date()}});
},async c=>{
 const outro=await criarUsuario([Papel.VENDEDOR]);
 await prisma.numeroWhatsApp.update({where:{id:c.conversa.numeroId},data:{donoId:outro.id}});
 await prisma.atendimentoWhatsApp.update({where:{id:c.selecionado.id},data:{responsavelId:outro.id}});
 await prisma.participanteAtendimentoWhatsApp.create({data:{atendimentoId:c.selecionado.id,usuarioId:c.admin.id,concedenteId:outro.id,inicio:new Date(Date.now()-60000),fim:new Date(Date.now()+3600000),podeEnviar:true,motivo:"Apoio fictício329"}});
}));

async function duasEsperando(c: Awaited<ReturnType<typeof cenario>>, executar:()=>Promise<unknown>) {
 let entrou!:()=>void,soltar!:()=>void;
 const pronta=new Promise<void>(r=>{entrou=r;}),liberar=new Promise<void>(r=>{soltar=r;});
 const bloqueadora=prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${c.selecionado.id} FOR UPDATE`;entrou();await liberar;},{timeout:20000});
 await pronta;const resultado=executar();
 try {
  await vi.waitFor(async()=>{const [r]=await prisma.$queryRaw<{n:bigint}[]>`SELECT count(*) AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%"AtendimentoWhatsApp"%'`;expect(Number(r.n)).toBeGreaterThanOrEqual(2);},{timeout:5000,interval:20});
 }finally{soltar();await bloqueadora;await resultado;}
 return resultado;
}
it("dois vínculos concorrentes observados na barreira SQL não sobrescrevem o vencedor",async()=>{
 const c=await cenario("VENDAS");
 const outro=await prisma.oportunidade.create({data:{nome:"Outro curso fictício329",telefoneE164:c.contato.telefoneE164,pessoaId:c.pessoa.id,vendedorDonoId:c.admin.id}});
 const rs=await duasEsperando(c,()=>Promise.all([vincularContatoWhatsApp(c.input),vincularContatoWhatsApp({...c.input,alvo:{tipo:"lead",id:outro.id}})])) as {ok:boolean}[];
 expect(rs.filter(r=>r.ok)).toHaveLength(1);
 const contato=await prisma.contatoWhatsApp.findUniqueOrThrow({where:{id:c.contato.id}}),a=await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.selecionado.id}});
 expect([c.lead.id,outro.id]).toContain(contato.leadId);expect(a.leadId).toBe(contato.leadId);expect(await eventos(c.contato.id)).toHaveLength(1);
});
it("vincular e desvincular concorrentes preservam Contato e selected sem ciclo de locks conhecido",async()=>{
 const c=await cenario("VENDAS");
 await prisma.contatoWhatsApp.update({where:{id:c.contato.id},data:{leadId:c.lead.id}});
 await prisma.atendimentoWhatsApp.update({where:{id:c.selecionado.id},data:{leadId:c.lead.id}});

 const log=vi.spyOn(console,"error").mockImplementation(()=>{});
 const rs=await duasEsperando(c,()=>Promise.all([vincularContatoWhatsApp(c.input),desvincularContatoWhatsApp({atendimentoId:c.selecionado.id,alvo:{tipo:"lead",id:c.lead.id},motivo:"Correção fictícia coordenada329"})])) as {ok:boolean}[];
 expect(log).not.toHaveBeenCalled();log.mockRestore();
 expect(rs[1].ok).toBe(true);
 const contato=await prisma.contatoWhatsApp.findUniqueOrThrow({where:{id:c.contato.id}}),a=await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.selecionado.id}});
 expect(a.leadId).toBe(contato.leadId);expect([null,c.lead.id]).toContain(contato.leadId);
 expect(await prisma.evento.count({where:{tipo:"ContatoDesvinculado",agregadoId:c.contato.id}})).toBe(1);
});
it("papéis revogados enquanto espera Lead também são relidos",()=>tentarAposEspera((tx,c)=>tx.usuario.update({where:{id:c.admin.id},data:{papeis:[Papel.PROFESSOR]}}),undefined,true));
it("carteira trocada enquanto espera Lead também é relida",()=>tentarAposEspera(async(tx,c)=>{
 const outro=await tx.usuario.create({data:{nome:"Outro dono Lead329",email:"outro-lead329@example.test",senhaHash:"x",papeis:[Papel.VENDEDOR]}});
 return tx.oportunidade.update({where:{id:c.lead.id},data:{vendedorDonoId:outro.id}});
},undefined,true));
it.each(["AtendimentoWhatsApp","ContatoWhatsApp"])("desvincular revalida papel após espera SQL em %s",async tabela=>{
 const c=await cenario("VENDAS");
 await prisma.contatoWhatsApp.update({where:{id:c.contato.id},data:{leadId:c.lead.id}});
 await prisma.atendimentoWhatsApp.update({where:{id:c.selecionado.id},data:{leadId:c.lead.id}});
 let entrou!:(pid:number)=>void,soltar!:()=>void;
 const pronta=new Promise<number>(r=>{entrou=r;}),liberar=new Promise<void>(r=>{soltar=r;});
 const bloqueadora=prisma.$transaction(async tx=>{
  const [p]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() AS pid`;
  if(tabela==="AtendimentoWhatsApp")await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${c.selecionado.id} FOR UPDATE`;
  else await tx.$queryRaw`SELECT id FROM "ContatoWhatsApp" WHERE id=${c.contato.id} FOR UPDATE`;
  entrou(p.pid);await liberar;
  await tx.usuario.update({where:{id:c.admin.id},data:{papeis:[Papel.VENDEDOR]}});
 },{timeout:20000});
 const pid=await pronta, acao=desvincularContatoWhatsApp({atendimentoId:c.selecionado.id,alvo:{tipo:"lead",id:c.lead.id},motivo:"Correção fictícia329"});
 try{await aguardarBloqueadoPor(pid);}finally{soltar();await bloqueadora;}
 expect((await acao).ok).toBe(false);
 expect((await prisma.contatoWhatsApp.findUniqueOrThrow({where:{id:c.contato.id}})).leadId).toBe(c.lead.id);
 expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.selecionado.id}})).leadId).toBe(c.lead.id);
 expect(await prisma.evento.count({where:{tipo:"ContatoDesvinculado",agregadoId:c.contato.id}})).toBe(0);
});