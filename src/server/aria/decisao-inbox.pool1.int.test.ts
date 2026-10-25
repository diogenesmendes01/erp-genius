import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, Prisma } from "@prisma/client";

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

const trace=vi.hoisted(()=>[] as string[]);
vi.mock("@/lib/prisma", async()=>{
 const {PrismaClient}=await import("@prisma/client");
 const url=new URL(process.env.DATABASE_URL!);url.searchParams.set("connection_limit","1");url.searchParams.set("pool_timeout","2");
  const prisma=new PrismaClient({datasources:{db:{url:url.toString()}},log:[{emit:"event",level:"query"}]});
 prisma.$on("query",e=>{if(e.query.includes('websearch_to_tsquery'))trace.push("FTS");else if(e.query.includes('FOR SHARE')&&e.query.includes('ConfiguracaoOperacional'))trace.push("CONFIG_SHARE");else if(e.query.includes('FOR UPDATE')&&e.query.includes('AtendimentoWhatsApp'))trace.push("ATENDIMENTO_UPDATE");else if(e.query.includes('FOR UPDATE')&&e.query.includes('AcaoAgenteIA'))trace.push("ACAO_UPDATE");});
 return {prisma};
});
import { prisma } from "@/lib/prisma";
import { configPadrao } from "./config-schema";
afterAll(async()=>prisma.$disconnect());
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { diaUtilAs } from "@/test/janela-envio";

import { seedCanal } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";





import { aprovarSugestaoNoInbox, desfazerSugestaoNoInbox } from "./decisao-inbox";

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



describe("354: uma conexão real, sem escape global na transação",()=>{
 let c:Awaited<ReturnType<typeof cenario>>;
 beforeEach(async()=>{
  await truncarBanco();authMock.mockReset();c=await cenario();logado(c.dono);
  await prisma.atendimentoWhatsApp.update({where:{id:c.at.id},data:{responsavelId:c.dono.id}});
 });
 async function sugestao(acao:"RESPONDER"|"AGENDAR_MENSAGEM",payload:Prisma.InputJsonObject){
  return prisma.acaoAgenteIA.create({data:{turnoId:c.turno.id,atendimentoId:c.at.id,oportunidadeId:c.op.id,acao,modoConfigurado:"SUGERE",status:"SUGERIDA",confianca:90,payload,reversivel:acao==="AGENDAR_MENSAGEM"}});
 }
 it("aprova resposta com fonte ativa e última fala: FTS real no mesmo cliente pool1",async()=>{
  const fonte=await prisma.fonteConhecimento.create({data:{tipo:"TEXTO",nome:"Fonte fictícia",status:"PRONTA",hashConteudo:"teste354",criadoPorId:c.gerente.id}});
  await prisma.trechoConhecimento.create({data:{fonteId:fonte.id,ordem:0,texto:"Oi, temos cursos e matrícula."}});
  const config=configPadrao();config.fontesAtivas=[fonte.id];
  await prisma.versaoAgenteIA.create({data:{numero:1,status:"PUBLICADA",config:config as unknown as Prisma.InputJsonObject,criadaPorId:c.gerente.id}});
  const acao=await sugestao("RESPONDER",{texto:"Olá, podemos conversar."});
  expect(await aprovarSugestaoNoInbox(c.at.id,acao.id)).toEqual({ok:true});
  expect(await prisma.intencaoMensagem.count({where:{acaoAgenteIAId:acao.id}})).toBe(1);
 });
 it("agenda na janela real com política/fuso no mesmo pool1 e desfaz",async()=>{
  const acao=await sugestao("AGENDAR_MENSAGEM",{texto:"Olá",agendadaPara:diaUtilAs(10).toISOString()});
  expect(await aprovarSugestaoNoInbox(c.at.id,acao.id)).toEqual({ok:true});
  expect(await desfazerSugestaoNoInbox(c.at.id,acao.id)).toEqual({ok:true});
  expect(await prisma.intencaoMensagem.count({where:{acaoAgenteIAId:acao.id,status:"CANCELADA"}})).toBe(1);
 });
 it("tarefa captura Config antes de Atendimento e não adquire novo Config depois",async()=>{
  const acao=await prisma.acaoAgenteIA.create({data:{turnoId:c.turno.id,atendimentoId:c.at.id,oportunidadeId:c.op.id,acao:"CRIAR_TAREFA",modoConfigurado:"SUGERE",status:"SUGERIDA",confianca:90,payload:{titulo:"Ligar",venceEmISO:new Date(Date.now()+86400000).toISOString()},reversivel:true}});
  trace.length=0;expect(await aprovarSugestaoNoInbox(c.at.id,acao.id)).toEqual({ok:true});
  expect(trace.filter(t=>t==="CONFIG_SHARE")).toHaveLength(1);
  expect(trace.indexOf("ACAO_UPDATE")).toBeLessThan(trace.indexOf("CONFIG_SHARE"));
  expect(trace.indexOf("CONFIG_SHARE")).toBeLessThan(trace.indexOf("ATENDIMENTO_UPDATE"));
 });
});
