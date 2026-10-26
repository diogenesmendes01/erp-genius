import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, Prisma, PrismaClient } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
// Mesmo limite do Vitest documentado em comercial/criar-lead-idempotencia.int.test.ts:
// imports concorrentes de auth escapam do mock. Só a fronteira da sessão é adaptada;
// usuário fresco, autorização pós-lock, decisões e executor continuam reais.
vi.mock("@/server/_shared/sessao", async original => {
  const real = await original<typeof import("@/server/_shared/sessao")>();
  return { ...real, exigirSessao: async () => {
    const id = (await authMock())?.user?.id;
    const u = typeof id === "string" ? await real.carregarUsuarioFresco(id) : null;
    if (!u) throw new real.ErroAutenticacao();
    if (real.apenasPortal(u)) throw new real.ErroPermissao("Acesso restrito ao portal do aluno.");
    return u;
  } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { carregarAriaDoAtendimento } from "../whatsapp/consultas-inbox";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { diaUtilAs } from "@/test/janela-envio";
import { comAvisosInbox } from "@/test/avisos-inbox";
import { seedCanal } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";




import { aprovarAcaoAria, desfazerAcaoAria, desfazerAcaoAriaTx, rejeitarAcaoAria } from "./historico";
import { aprovarSugestaoNoInbox, rejeitarSugestaoNoInbox, desfazerSugestaoNoInbox } from "./decisao-inbox";

type U = Awaited<ReturnType<typeof criarUsuario>>;
const logado = (u: U) => authMock.mockResolvedValue({ user: { id: u.id } });

let seq = 0;
async function cenario() {
  const cat = await seedCatalogoMinimo();
  const gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  const gerenteOutra = await criarUsuario([Papel.GERENTE_COMERCIAL], "Outra equipe");
  const dono = await criarUsuario([Papel.VENDEDOR]);
  await prisma.usuario.update({ where: { id: dono.id }, data: { gerenteComercialId: gerente.id } });
  const { numero } = await seedCanal({ estado: "ATIVA" });
  const pessoa = await prisma.pessoa.create({ data: { nome: "Maria" } });
  const op = await prisma.oportunidade.create({
    data: { nome: "Maria", paisId: cat.pais.id, telefoneE164: "+50688888888", vendedorDonoId: dono.id, pessoaId: pessoa.id },
  });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688888888", leadId: op.id } });
  const at = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: op.id }));
  const conv = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: at.id }, select: { conversaId: true } });
  const ancora = await prisma.mensagemWhatsApp.create({
    data: { atendimentoId: at.id, conversaId: conv.conversaId, numeroId: numero.id, direcao: "ENTRADA", corpo: "oi", driver: "MOTOR", status: "ENTREGUE", providerMessageId: `hist-${++seq}` },
  });
  const turno = await prisma.turnoAgenteIA.create({ data: { ancoraMensagemId: ancora.id, atendimentoId: at.id, tipo: "ATENDIMENTO", resultado: "EM_ANDAMENTO" } });
  const tag = await prisma.tag.create({ data: { nome: "Interessado", cor: "INFO" } });
  const campo = await prisma.campoPersonalizado.create({ data: { nome: "objetivo", tipo: "TEXTO", alvo: "PESSOA" } });
  return { op, at, turno, tag, campo, pessoa, gerente, gerenteOutra, dono };
}


describe("354 D1 decisão contextual real", () => {
 let c: Awaited<ReturnType<typeof cenario>>;
 beforeEach(async()=>{
  await truncarBanco(); authMock.mockReset(); c=await cenario();
  await prisma.atendimentoWhatsApp.update({where:{id:c.at.id},data:{responsavelId:c.dono.id}});
  logado(c.dono);
 });
 async function sugestao(acao: "TAG"|"MOVER_ETAPA"|"RESPONDER"|"CRIAR_TAREFA"|"AGENDAR_MENSAGEM" = "TAG", payload?: Prisma.InputJsonObject){
  const dados=payload??(acao==="TAG"?{pessoaId:c.pessoa.id,tagId:c.tag.id,nome:c.tag.nome}:acao==="MOVER_ETAPA"?{de:"NOVO",para:"EM_ATENDIMENTO"}:acao==="RESPONDER"?{texto:"Olá, podemos conversar."}:acao==="CRIAR_TAREFA"?{titulo:"Ligar",venceEmISO:new Date(Date.now()+86400000).toISOString()}:{texto:"Olá",agendadaPara:diaUtilAs(10).toISOString()});
  return prisma.acaoAgenteIA.create({data:{turnoId:c.turno.id,atendimentoId:c.at.id,oportunidadeId:c.op.id,acao,modoConfigurado:"SUGERE",status:"SUGERIDA",confianca:90,payload:dados,reversivel:acao!=="RESPONDER"}});
 }
 it("334 undo concorrente do mesmo autor emite efeito/Evento/aviso uma vez, replay zero",async()=>{
  const s=await sugestao();await aprovarSugestaoNoInbox(c.at.id,s.id);
  const primeiro=await comAvisosInbox(()=>Promise.all([desfazerSugestaoNoInbox(c.at.id,s.id),desfazerSugestaoNoInbox(c.at.id,s.id)]));
  expect(primeiro.resultado).toEqual([{ok:true},{ok:true}]);
  expect(primeiro.avisos.filter(a=>a.tipo==="atendimento.atualizado"&&a.atendimentoId===c.at.id)).toHaveLength(1);
  expect(await prisma.evento.count({where:{tipo:"TagRemovida",payload:{path:["acaoAgenteIAId"],equals:s.id}}})).toBe(1);
  const replay=await comAvisosInbox(()=>desfazerSugestaoNoInbox(c.at.id,s.id));expect(replay.resultado).toEqual({ok:true});expect(replay.avisos).toEqual([]);
 });
 it("334 Evento posterior de outro autor não comprova replay mesmo com desfeitaPorId antigo",async()=>{
  const s=await sugestao();await aprovarSugestaoNoInbox(c.at.id,s.id);await desfazerSugestaoNoInbox(c.at.id,s.id);
  await prisma.evento.create({data:{tipo:"AcaoAriaDesfeita",agregadoTipo:"AcaoAgenteIA",agregadoId:s.id,autorId:c.gerente.id,payload:{acaoAgenteIAId:s.id,acao:s.acao},criadoEm:new Date(Date.now()+1000)}});
  expect((await desfazerSugestaoNoInbox(c.at.id,s.id)).ok).toBe(false);
 });
 it("334 replay revalida papel após espera SQL real",async()=>{
  const s=await sugestao();await aprovarSugestaoNoInbox(c.at.id,s.id);await desfazerSugestaoNoInbox(c.at.id,s.id);
  const r=await duranteLock(s.id,"acao",()=>desfazerSugestaoNoInbox(c.at.id,s.id),db=>db.usuario.update({where:{id:c.dono.id},data:{papeis:[Papel.PROFESSOR]}}));
  expect(r.ok).toBe(false);expect(await prisma.evento.count({where:{tipo:"AcaoAriaDesfeita",agregadoId:s.id}})).toBe(1);
 });
 it("334 replay mantém verificação do vínculo real da tarefa",async()=>{
  const s=await sugestao("CRIAR_TAREFA");await aprovarSugestaoNoInbox(c.at.id,s.id);expect(await desfazerSugestaoNoInbox(c.at.id,s.id)).toEqual({ok:true});
  const outro=await prisma.oportunidade.create({data:{nome:"Outro contexto334",vendedorDonoId:c.dono.id}});
  await prisma.tarefa.updateMany({where:{atendimentoId:c.at.id},data:{leadId:outro.id}});
  expect((await desfazerSugestaoNoInbox(c.at.id,s.id)).ok).toBe(false);expect(await prisma.evento.count({where:{tipo:"AcaoAriaDesfeita",agregadoId:s.id}})).toBe(1);
 });
 it("334 alteração humana posterior recusa undo sem Evento/aviso e preserva o valor",async()=>{
  const s=await sugestao("TAG");await prisma.acaoAgenteIA.update({where:{id:s.id},data:{acao:"ATUALIZAR_CAMPO",payload:{pessoaId:c.pessoa.id,campoId:c.campo.id,nomeCampo:"Objetivo",de:null,para:"Aria"}}});
  expect(await aprovarSugestaoNoInbox(c.at.id,s.id)).toEqual({ok:true});
  await prisma.valorCampoPersonalizado.updateMany({where:{pessoaId:c.pessoa.id,campoId:c.campo.id},data:{valor:"Humano"}});
  const r=await comAvisosInbox(()=>desfazerSugestaoNoInbox(c.at.id,s.id));expect(r.resultado.ok).toBe(false);expect(r.avisos).toEqual([]);
  expect((await prisma.valorCampoPersonalizado.findFirstOrThrow({where:{pessoaId:c.pessoa.id,campoId:c.campo.id}})).valor).toBe("Humano");
  expect(await prisma.evento.count({where:{tipo:"AcaoAriaDesfeita",agregadoId:s.id}})).toBe(0);
 });
 it("334 núcleo: falha de Evento injetada reverte efeito/status/Evento e não publica NOTIFY",async()=>{
  const s=await sugestao();await aprovarSugestaoNoInbox(c.at.id,s.id);
  const r=await comAvisosInbox(async()=>{
   await expect(prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "AcaoAgenteIA" WHERE id=${s.id} FOR UPDATE`;
    const atual=await tx.acaoAgenteIA.findUniqueOrThrow({where:{id:s.id}});
    const falho=new Proxy(tx,{get(alvo,chave){
     if(chave==="evento")return new Proxy(alvo.evento,{get(modelo,metodo){
      if(metodo==="create")return (args:Prisma.EventoCreateArgs)=>{if(args.data.tipo==="AcaoAriaDesfeita")throw Error("FalhaEvento334");return modelo.create(args);};
      const valor=Reflect.get(modelo,metodo);return typeof valor==="function"?valor.bind(modelo):valor;
     }});
     const valor=Reflect.get(alvo,chave);return typeof valor==="function"?valor.bind(alvo):valor;
    }});
    await desfazerAcaoAriaTx(falho,atual,c.dono,{replayMesmoAutorNoInbox:true});
   })).rejects.toThrow("FalhaEvento334");
  });
  expect(r.avisos).toEqual([]);expect(await prisma.pessoaTag.count()).toBe(1);
  expect((await prisma.acaoAgenteIA.findUniqueOrThrow({where:{id:s.id}})).status).toBe("APROVADA");
  expect(await prisma.evento.count({where:{agregadoId:s.id,tipo:"AcaoAriaDesfeita"}})).toBe(0);
  expect(await prisma.evento.count({where:{tipo:"TagRemovida",payload:{path:["acaoAgenteIAId"],equals:s.id}}})).toBe(0);
 });
 it("334 replay Inbox exige mesmo autor e Evento comprovado; global continua recusando",async()=>{
  const s=await sugestao();
  expect(await aprovarSugestaoNoInbox(c.at.id,s.id)).toEqual({ok:true});
  expect(await desfazerSugestaoNoInbox(c.at.id,s.id)).toEqual({ok:true});
  expect(await desfazerSugestaoNoInbox(c.at.id,s.id)).toEqual({ok:true});
  expect(await prisma.evento.count({where:{tipo:"AcaoAriaDesfeita",agregadoId:s.id}})).toBe(1);
  logado(c.gerente);expect((await desfazerAcaoAria(s.id)).ok).toBe(false);
  expect((await desfazerSugestaoNoInbox(c.at.id,s.id)).ok).toBe(false);
  logado(c.dono);
  await prisma.evento.deleteMany({where:{tipo:"AcaoAriaDesfeita",agregadoId:s.id}});
  expect((await desfazerSugestaoNoInbox(c.at.id,s.id)).ok).toBe(false);
 });
 it("334 replay não contorna revogação nem troca de Pessoa do efeito",async()=>{
  const s=await sugestao();await aprovarSugestaoNoInbox(c.at.id,s.id);await desfazerSugestaoNoInbox(c.at.id,s.id);
  await prisma.atendimentoWhatsApp.update({where:{id:c.at.id},data:{responsavelId:null}});
  expect((await desfazerSugestaoNoInbox(c.at.id,s.id)).ok).toBe(false);
  await prisma.atendimentoWhatsApp.update({where:{id:c.at.id},data:{responsavelId:c.dono.id}});
  const outra=await prisma.pessoa.create({data:{nome:"Outra334"}});
  await prisma.oportunidade.update({where:{id:c.op.id},data:{pessoaId:outra.id}});
  expect((await desfazerSugestaoNoInbox(c.at.id,s.id)).ok).toBe(false);
  expect(await prisma.evento.count({where:{tipo:"AcaoAriaDesfeita",agregadoId:s.id}})).toBe(1);
 });
 it("responsável aprova e desfaz sem receber a API global",async()=>{
  const s=await sugestao();
  expect((await aprovarAcaoAria(s.id)).ok).toBe(false);
  expect(await aprovarSugestaoNoInbox(c.at.id,s.id)).toEqual({ok:true});
  expect(await aprovarSugestaoNoInbox(c.at.id,s.id)).toEqual({ok:true});
  expect(await prisma.pessoaTag.count()).toBe(1);
  expect((await desfazerAcaoAria(s.id)).ok).toBe(false);
  expect(await desfazerSugestaoNoInbox(c.at.id,s.id)).toEqual({ok:true});
  expect(await prisma.pessoaTag.count()).toBe(0);
  expect(await prisma.evento.count({where:{tipo:"AcaoAriaAprovada",agregadoId:s.id}})).toBe(1);
  expect(await prisma.evento.count({where:{tipo:"AcaoAriaDesfeita",agregadoId:s.id}})).toBe(1);
 });
 it("responsável rejeita com repetição natural sem liberar rejeição global",async()=>{
  const s=await sugestao();
  expect((await rejeitarAcaoAria(s.id)).ok).toBe(false);
  expect(await rejeitarSugestaoNoInbox(c.at.id,s.id,"Agora não")).toEqual({ok:true});
  expect(await rejeitarSugestaoNoInbox(c.at.id,s.id,"Agora não")).toEqual({ok:true});
  expect(await prisma.evento.count({where:{tipo:"AcaoAriaRejeitada",agregadoId:s.id}})).toBe(1);
 });
 it("carteira sem responsabilidade não recebe exceção",async()=>{
  await prisma.atendimentoWhatsApp.update({where:{id:c.at.id},data:{responsavelId:null}});
  const s=await sugestao(); expect((await aprovarSugestaoNoInbox(c.at.id,s.id)).ok).toBe(false);
 });
 it("responsável atual não precisa ser dono comercial",async()=>{
  const vendedor=await criarUsuario([Papel.VENDEDOR]);
  const at=await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.at.id},include:{conversa:true}});
  await prisma.numeroWhatsApp.update({where:{id:at.conversa.numeroId},data:{donoId:vendedor.id,finalidade:"VENDAS"}});
  await prisma.atendimentoWhatsApp.update({where:{id:c.at.id},data:{responsavelId:vendedor.id}});
  logado(vendedor); const s=await sugestao();
  expect(await aprovarSugestaoNoInbox(c.at.id,s.id)).toEqual({ok:true});
 });
 it("ação de outra conversa não usa a responsabilidade local",async()=>{
  const s=await sugestao(); expect((await aprovarSugestaoNoInbox("outra",s.id)).ok).toBe(false);
 });
 it("alvo divergente não ganha exceção",async()=>{
  const s=await sugestao(); await prisma.acaoAgenteIA.update({where:{id:s.id},data:{oportunidadeId:"inexistente"}});
  expect((await aprovarSugestaoNoInbox(c.at.id,s.id)).ok).toBe(false);
 });
 it("payload de pessoa divergente não troca o alvo autorizado",async()=>{
  const p=await prisma.pessoa.create({data:{nome:"Outra"}});
  const s=await sugestao("TAG",{pessoaId:p.id,tagId:c.tag.id,nome:c.tag.nome});
  expect((await aprovarSugestaoNoInbox(c.at.id,s.id)).ok).toBe(false);
  expect(await prisma.pessoaTag.count()).toBe(0);
 });
 it("não desfaz mudança humana posterior",async()=>{
  const s=await sugestao("MOVER_ETAPA"); expect(await aprovarSugestaoNoInbox(c.at.id,s.id)).toEqual({ok:true});
  await prisma.oportunidade.update({where:{id:c.op.id},data:{etapa:"PERDIDO"}});
  expect((await desfazerSugestaoNoInbox(c.at.id,s.id)).ok).toBe(false);
 });
 it("não desfaz resposta enviada irreversível",async()=>{
  const s=await sugestao("RESPONDER"); expect(await aprovarSugestaoNoInbox(c.at.id,s.id)).toEqual({ok:true});
  expect((await desfazerSugestaoNoInbox(c.at.id,s.id)).ok).toBe(false);
 });
 it("cria tarefa usando configuração antes do atendimento",async()=>{
  const s=await sugestao("CRIAR_TAREFA"); expect(await aprovarSugestaoNoInbox(c.at.id,s.id)).toEqual({ok:true});
  expect(await prisma.tarefa.count({where:{atendimentoId:c.at.id}})).toBe(1);
  expect(await desfazerSugestaoNoInbox(c.at.id,s.id)).toEqual({ok:true});
 });
 it("agenda e desfaz sem despacho externo",async()=>{
  const s=await sugestao("AGENDAR_MENSAGEM"); expect(await aprovarSugestaoNoInbox(c.at.id,s.id)).toEqual({ok:true});
  expect(await desfazerSugestaoNoInbox(c.at.id,s.id)).toEqual({ok:true});
  expect(await prisma.intencaoMensagem.count({where:{atendimentoId:c.at.id,status:"CANCELADA"}})).toBe(1);
 });
 async function duranteLock(id:string,tipo:"acao"|"lead",executar:()=>Promise<{ok:boolean}>,alterar:(db:PrismaClient)=>Promise<unknown>){
  const url=new URL(process.env.DATABASE_URL!);url.searchParams.set("connection_limit","1");
  const holder=new PrismaClient({datasources:{db:{url:url.toString()}}}),observer=new PrismaClient({datasources:{db:{url:url.toString()}}});
  let liberar!:()=>void,entrou!:()=>void;const retido=new Promise<void>(r=>{liberar=r;}),travado=new Promise<void>(r=>{entrou=r;});
  const lock=holder.$transaction(async tx=>{if(tipo==="acao")await tx.$queryRaw`SELECT id FROM "AcaoAgenteIA" WHERE id=${id} FOR UPDATE`;else await tx.$queryRaw`SELECT id FROM "Lead" WHERE id=${id} FOR UPDATE`;entrou();await retido;},{timeout:20000});
  let pendente:Promise<{ok:boolean}>|undefined;
  try{
   await Promise.race([travado,new Promise((_,reject)=>setTimeout(()=>reject(Error("holder não travou")),5000))]);
   pendente=executar();let esperou=false;
   for(const fim=Date.now()+8000;Date.now()<fim;){
    const rows=await observer.$queryRaw<{esperou:boolean}[]>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND pid<>pg_backend_pid()) AS esperou`;
    if(rows[0]?.esperou){esperou=true;break;}await new Promise(r=>setTimeout(r,10));
   }
   expect(esperou).toBe(true);await alterar(observer);
  }finally{liberar();await lock;}
  try{return await pendente!;}finally{await holder.$disconnect();await observer.$disconnect();}
 }
 it.each(["aprovar","rejeitar","desfazer"] as const)("%s revalida responsabilidade depois do lock da ação",async verbo=>{
  const acao=await sugestao();if(verbo==="desfazer")expect(await aprovarSugestaoNoInbox(c.at.id,acao.id)).toEqual({ok:true});
  const executar=()=>verbo==="aprovar"?aprovarSugestaoNoInbox(c.at.id,acao.id):verbo==="rejeitar"?rejeitarSugestaoNoInbox(c.at.id,acao.id):desfazerSugestaoNoInbox(c.at.id,acao.id);
  const r=await duranteLock(acao.id,"acao",executar,db=>db.atendimentoWhatsApp.update({where:{id:c.at.id},data:{responsavelId:null}}));
  expect(r.ok).toBe(false);expect((await prisma.acaoAgenteIA.findUniqueOrThrow({where:{id:acao.id}})).status).toBe(verbo==="desfazer"?"APROVADA":"SUGERIDA");
 });
 it("revogação de papel durante espera do alvo é revalidada antes do efeito",async()=>{
  const acao=await sugestao();const r=await duranteLock(c.op.id,"lead",()=>aprovarSugestaoNoInbox(c.at.id,acao.id),db=>db.usuario.update({where:{id:c.dono.id},data:{papeis:[Papel.PROFESSOR]}}));
  expect(r.ok).toBe(false);expect(await prisma.pessoaTag.count()).toBe(0);
 });
 it("default global de desfazer conserva a sessão anterior ao lock, sem alterar contrato histórico",async()=>{
  const acao=await sugestao();logado(c.gerente);expect(await aprovarAcaoAria(acao.id)).toEqual({ok:true});
  const r=await duranteLock(acao.id,"acao",()=>desfazerAcaoAria(acao.id),db=>db.usuario.update({where:{id:c.gerente.id},data:{papeis:[Papel.PROFESSOR]}}));
  expect(r).toEqual({ok:true});expect(await prisma.pessoaTag.count()).toBe(0);
 });
 it("aprovar versus rejeitar concorrentes tem só uma decisão e efeito consistente",async()=>{
  const acao=await sugestao();const rs=await Promise.all([aprovarSugestaoNoInbox(c.at.id,acao.id),rejeitarSugestaoNoInbox(c.at.id,acao.id)]);
  expect(rs.filter(r=>r.ok)).toHaveLength(1);
  expect(await prisma.evento.count({where:{agregadoId:acao.id,tipo:{in:["AcaoAriaAprovada","AcaoAriaRejeitada"]}}})).toBe(1);
  const atual=await prisma.acaoAgenteIA.findUniqueOrThrow({where:{id:acao.id}});expect(await prisma.pessoaTag.count()).toBe(atual.status==="APROVADA"?1:0);
 });
 it("repetição não emite novo aviso de atualização",async()=>{
  const acao=await sugestao();expect(await rejeitarSugestaoNoInbox(c.at.id,acao.id,"não")).toEqual({ok:true});
  const r=await comAvisosInbox(()=>rejeitarSugestaoNoInbox(c.at.id,acao.id,"não"));expect(r.resultado).toEqual({ok:true});expect(r.avisos).toEqual([]);
 });
 it("DTO real acompanha decidir/desfazer/desfeita sem conceder CRM global",async()=>{
  const acao=await sugestao();const inicial=await carregarAriaDoAtendimento(c.dono,c.at.id);
  expect(inicial?.podeDecidir).toBe(true);expect(inicial?.cartoes.find(s=>s.id===acao.id)).toMatchObject({podeDecidir:true,podeDesfazer:false});
  expect(await aprovarSugestaoNoInbox(c.at.id,acao.id)).toEqual({ok:true});
  expect((await carregarAriaDoAtendimento(c.dono,c.at.id))?.cartoes.find(s=>s.id===acao.id)).toMatchObject({status:"APROVADA",podeDecidir:false,podeDesfazer:true});
  expect(await desfazerSugestaoNoInbox(c.at.id,acao.id)).toEqual({ok:true});
  expect((await carregarAriaDoAtendimento(c.dono,c.at.id))?.cartoes.find(s=>s.id===acao.id)).toMatchObject({status:"DESFEITA",podeDecidir:false,podeDesfazer:false,desfeitaPorId:c.dono.id,desfeitaPorNome:c.dono.nome});
 });
 it("convite revogado durante lock remove o acesso contextual do responsável",async()=>{
  const vendedor=await criarUsuario([Papel.VENDEDOR]);
  await prisma.atendimentoWhatsApp.update({where:{id:c.at.id},data:{responsavelId:vendedor.id}});
  const convite=await prisma.participanteAtendimentoWhatsApp.create({data:{atendimentoId:c.at.id,usuarioId:vendedor.id,concedenteId:c.gerente.id,inicio:new Date(Date.now()-60000),fim:new Date(Date.now()+3600000),motivo:"Teste D1"}});
  logado(vendedor);const acao=await sugestao();
  expect((await carregarAriaDoAtendimento(vendedor,c.at.id))?.podeDecidir).toBe(true);
  const r=await duranteLock(acao.id,"acao",()=>aprovarSugestaoNoInbox(c.at.id,acao.id),db=>db.participanteAtendimentoWhatsApp.update({where:{id:convite.id},data:{revogadoEm:new Date()}}));
  expect(r.ok).toBe(false);expect(await prisma.pessoaTag.count()).toBe(0);
 });
 it("mudança de carteira após lock exige acesso atual à conversa",async()=>{
  const outro=await criarUsuario([Papel.VENDEDOR]);const acao=await sugestao();
  const r=await duranteLock(acao.id,"acao",()=>aprovarSugestaoNoInbox(c.at.id,acao.id),db=>db.oportunidade.update({where:{id:c.op.id},data:{vendedorDonoId:outro.id}}));
  expect(r.ok).toBe(false);expect(await prisma.pessoaTag.count()).toBe(0);
 });
 it("mudança de equipe após lock revoga o escopo global do gerente no Inbox",async()=>{
  logado(c.gerente);const acao=await sugestao();
  const r=await duranteLock(acao.id,"acao",()=>aprovarSugestaoNoInbox(c.at.id,acao.id),db=>db.usuario.update({where:{id:c.dono.id},data:{gerenteComercialId:c.gerenteOutra.id}}));expect(r.ok).toBe(false);
 });
 it("usuário desativado depois de esperar ação não decide",async()=>{
  const acao=await sugestao();const r=await duranteLock(acao.id,"acao",()=>rejeitarSugestaoNoInbox(c.at.id,acao.id),db=>db.usuario.update({where:{id:c.dono.id},data:{ativo:false}}));expect(r.ok).toBe(false);
 });
 it.each([false,true])("alvo efetivo: Inbox exige ambos os leads, API global histórica preservada (ambos=%s)",async ambos=>{
  const acao=await sugestao("RESPONDER");
  const vendedor=ambos?c.dono:await criarUsuario([Papel.VENDEDOR]);
  const pessoa=await prisma.pessoa.create({data:{nome:"Alvo efetivo"}});
  const atual=await prisma.oportunidade.create({data:{nome:"Alvo efetivo",vendedorDonoId:vendedor.id,pessoaId:pessoa.id}});
  await prisma.atendimentoWhatsApp.update({where:{id:c.at.id},data:{leadId:atual.id}});logado(c.gerente);
  const dto=await carregarAriaDoAtendimento(c.gerente,c.at.id);
  expect(dto?.cartoes.some(c=>c.id===acao.id)).toBe(ambos);
  expect((await aprovarSugestaoNoInbox(c.at.id,acao.id)).ok).toBe(ambos);
  if(!ambos){expect(await prisma.intencaoMensagem.count()).toBe(0);expect(await aprovarAcaoAria(acao.id)).toEqual({ok:true});}
  expect(await prisma.intencaoMensagem.findFirstOrThrow()).toMatchObject({leadId:atual.id,acaoAgenteIAId:acao.id});
 });
 it("lock inicial continua serializando troca de responsável durante espera do Lead",async()=>{
  const acao=await sugestao();const url=new URL(process.env.DATABASE_URL!);url.searchParams.set("connection_limit","1");
  const holder=new PrismaClient({datasources:{db:{url:url.toString()}}}),writer=new PrismaClient({datasources:{db:{url:url.toString()}}}),observer=new PrismaClient({datasources:{db:{url:url.toString()}}});
  let liberar!:()=>void,entrou!:()=>void,holderPid=0;const retido=new Promise<void>(r=>{liberar=r;}),travado=new Promise<void>(r=>{entrou=r;});
  const lock=holder.$transaction(async tx=>{holderPid=(await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() AS pid`)[0].pid;await tx.$queryRaw`SELECT id FROM "Lead" WHERE id=${c.op.id} FOR UPDATE`;entrou();await retido;},{timeout:20000});
  let decisao:ReturnType<typeof aprovarSugestaoNoInbox>|undefined,troca:Promise<unknown>|undefined;
  type Espera={pid:number;blockers:number[]};
  async function esperar(condicao:(r:Espera[])=>number|false|undefined){const fim=Date.now()+1800;while(Date.now()<fim){const r=await observer.$queryRaw<Espera[]>`SELECT pid,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND pid<>pg_backend_pid()`;const id=condicao(r);if(id)return id;await new Promise<void>(r=>setImmediate(r));}throw Error("Espera nativa não observada");}
  try{
   await travado;decisao=aprovarSugestaoNoInbox(c.at.id,acao.id);
   const pidDecisao=await esperar(rows=>rows.find(r=>r.blockers.includes(holderPid))?.pid);
   troca=writer.atendimentoWhatsApp.update({where:{id:c.at.id},data:{responsavelId:null}}).then(r=>r);
   await esperar(rows=>rows.find(r=>r.pid!==pidDecisao&&r.blockers.includes(pidDecisao))?.pid);
   liberar();await lock;expect(await decisao).toEqual({ok:true});await troca;
   expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.at.id}})).responsavelId).toBeNull();
   expect(await prisma.evento.count({where:{tipo:"AcaoAriaAprovada",agregadoId:acao.id}})).toBe(1);
   expect((await aprovarSugestaoNoInbox(c.at.id,acao.id)).ok).toBe(false);
  }finally{liberar();await Promise.allSettled([lock,decisao,troca]);await Promise.allSettled([holder.$disconnect(),writer.$disconnect(),observer.$disconnect()]);}
 });
});
