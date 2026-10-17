import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";
import type { AvisoInbox } from "./barramento";
import { criarFiltroDeAvisos, formatarSSE } from "./eventos-sse";

let a: { id: string; conversaId: string };
let v1: Awaited<ReturnType<typeof criarUsuario>>, fin: typeof v1, v2: typeof v1, numeroId: string;
const sess = (u: typeof v1) => ({ id: u.id, nome: u.nome, papeis: u.papeis }) as never;
const aviso = (x: { id: string; conversaId: string }): AvisoInbox => ({ tipo: "mensagem.nova", atendimentoId: x.id, mensagemId: "m1", conversaId: x.conversaId });

beforeEach(async () => {
  await truncarBanco();
  v1 = await criarUsuario([Papel.VENDEDOR]); v2 = await criarUsuario([Papel.VENDEDOR]); fin = await criarUsuario([Papel.FINANCEIRO]);
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511999999999", rotulo: "Inst", driver: "BAILEYS", finalidade: "VENDAS", donoId: null } });
  numeroId = numero.id;
  const lead = await prisma.oportunidade.create({ data: { nome: "Maria", telefoneE164: "+50688888888", vendedorDonoId: v1.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688888888", leadId: lead.id } });
  a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId, contatoId: contato.id, finalidade: "COMERCIAL", leadId: lead.id }));
});
afterAll(() => prisma.$disconnect());

const participar = () => prisma.participanteAtendimentoWhatsApp.create({ data: { atendimentoId: a.id, usuarioId: fin.id, concedenteId: v1.id,
  inicio: new Date(Date.now() - 60_000), fim: new Date(Date.now() + 3600_000), motivo: "teste" } });

describe("filtro de avisos do SSE", () => {
  it("avisa quem vê e não avisa quem não vê", async () => {
    expect(await criarFiltroDeAvisos(sess(v1))(aviso(a))).toBe(true);
    expect(await criarFiltroDeAvisos(sess(fin))(aviso(a))).toBe(false);
    expect(await criarFiltroDeAvisos(sess(v2))(aviso(a))).toBe(false);
  });
  it("para de avisar quem perdeu o escopo", async () => {
    const p = await participar();
    const filtro = criarFiltroDeAvisos(sess(fin), 0);
    expect(await filtro(aviso(a))).toBe(true);
    await prisma.participanteAtendimentoWhatsApp.update({ where: { id: p.id }, data: { revogadoEm: new Date() } });
    expect(await filtro(aviso(a))).toBe(false);
  });
  it("cache por TTL: dentro do prazo não reconsulta", async () => {
    const p = await participar();
    const filtro = criarFiltroDeAvisos(sess(fin));
    expect(await filtro(aviso(a))).toBe(true);
    await prisma.participanteAtendimentoWhatsApp.update({ where: { id: p.id }, data: { revogadoEm: new Date() } });
    expect(await filtro(aviso(a))).toBe(true);
  });
  it("mensagem de grupo (sem atendimento) passa pelo escopoGrupos", async () => {
    const grupo = await prisma.grupoWhatsApp.create({ data: { numeroId, grupoJid: "g1@g.us", nome: "G" } });
    const conv = await prisma.conversaWhatsApp.create({ data: { numeroId, grupoId: grupo.id } });
    const av: AvisoInbox = { tipo: "mensagem.nova", atendimentoId: null, mensagemId: "m2", conversaId: conv.id };
    expect(await criarFiltroDeAvisos(sess(v1))(av)).toBe(true);
    expect(await criarFiltroDeAvisos(sess(fin))(av)).toBe(false);
  });
  it("aviso sem atendimento de conversa individual não passa", async () => {
    expect(await criarFiltroDeAvisos(sess(v1))({ tipo: "mensagem.nova", atendimentoId: null, mensagemId: null, conversaId: a.conversaId })).toBe(false);
  });
});

describe("formato SSE", () => {
  it("event + data + linha em branco", () => {
    expect(formatarSSE(aviso(a))).toBe(`event: mensagem.nova\ndata: ${JSON.stringify(aviso(a))}\n\n`);
  });
});
