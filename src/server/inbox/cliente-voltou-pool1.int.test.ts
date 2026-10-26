import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { Papel, type FinalidadeNumero } from "@prisma/client";
vi.hoisted(() => { const url = new URL(process.env.DATABASE_URL!); url.searchParams.set("connection_limit", "1"); url.searchParams.set("pool_timeout", "3"); process.env.DATABASE_URL = url.toString(); (globalThis as { prisma?: unknown }).prisma = undefined; });
const falha = vi.hoisted(() => ({ evento: false }));
vi.mock("@/server/_shared/evento", async original => { const real = await original<typeof import("@/server/_shared/evento")>(); return { ...real, registrarEvento: async (...args: Parameters<typeof real.registrarEvento>) => { if (falha.evento) throw new Error("Falha sintética de Evento329"); return real.registrarEvento(...args); } }; });
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
import { vincularContatoWhatsApp } from "@/server/whatsapp/acoes";
import { vincularLeadRetornoNoInbox } from "@/server/inbox/acoes-cliente-voltou";

beforeEach(async () => { await truncarBanco(); sessao.usuarioId = ""; falha.evento = false; });
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


it("pool1 ACTION real mantém Contato/selected/Evento na TX, repetição manual grava novamente",async()=>{
 const c=await cenario("VENDAS");
 expect((await vincularLeadRetornoNoInbox(c.input)).ok).toBe(true);
 expect((await vincularLeadRetornoNoInbox(c.input)).ok).toBe(true);
 expect((await prisma.contatoWhatsApp.findUniqueOrThrow({where:{id:c.contato.id}})).leadId).toBe(c.lead.id);
 expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.selecionado.id}})).leadId).toBe(c.lead.id);
 expect(await eventos(c.contato.id)).toHaveLength(2);
});
it.each(["contato-null","lead-null"])("legado Pessoa %s continua permitido pelo alvo/telefone/carteira",async caso=>{
 const c=await cenario("VENDAS");
 if(caso==="contato-null")await prisma.contatoWhatsApp.update({where:{id:c.contato.id},data:{pessoaId:null}});
 else await prisma.oportunidade.update({where:{id:c.lead.id},data:{pessoaId:null}});
 expect((await vincularLeadRetornoNoInbox(c.input)).ok).toBe(true);
 expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.selecionado.id}})).leadId).toBe(c.lead.id);
});
it("erro injetado após writes faz rollback real de Contato/selected e não cria Evento",async()=>{
 const c=await cenario("VENDAS");falha.evento=true;
 const log=vi.spyOn(console,"error").mockImplementation(()=>{});
 try {expect((await vincularLeadRetornoNoInbox(c.input)).ok).toBe(false);}finally{log.mockRestore();falha.evento=false;}
 expect((await prisma.contatoWhatsApp.findUniqueOrThrow({where:{id:c.contato.id}})).leadId).toBeNull();
 expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.selecionado.id}})).leadId).toBeNull();
 expect(await eventos(c.contato.id)).toHaveLength(0);
 expect(await prisma.atendimentoWhatsApp.count({where:{conversaId:c.conversa.id}})).toBe(1);
});
it.each(["VENDAS","AGENDA"] as const)("pool1 legado real %s mantém contexto e repetição manual",async finalidade=>{
 expect(process.env.DATABASE_URL).toContain("connection_limit=1");const c=await cenario(finalidade);
 const outra=await prisma.pessoa.create({data:{nome:"Pessoa divergente legada435"}});await prisma.contatoWhatsApp.update({where:{id:c.contato.id},data:{pessoaId:outra.id}});
 expect(await vincularContatoWhatsApp(c.input)).toEqual({ok:true});expect(await vincularContatoWhatsApp(c.input)).toEqual({ok:true});
 expect(await prisma.contatoWhatsApp.findUniqueOrThrow({where:{id:c.contato.id}})).toMatchObject({leadId:c.lead.id,pessoaId:outra.id});
 expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.selecionado.id}})).leadId).toBe(finalidade==="VENDAS"?c.lead.id:null);expect(await eventos(c.contato.id)).toHaveLength(2);
});