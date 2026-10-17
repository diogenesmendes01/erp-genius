import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";

let numeroId: string;
let contatoId: string;
let msg: { id: string };

async function novaIntencao(clientMessageId?: string) {
  return prisma.intencaoMensagem.create({
    data: { numeroId, contatoId, origem: "HUMANO", corpoRenderizado: "oi", clientMessageId },
  });
}

beforeEach(async () => {
  await truncarBanco();
  const n = await criarNumeroSetor({ telefoneE164: "+5511900000077", setores: ["COMERCIAL"] });
  numeroId = n.id;
  const c = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+5511911110077" } });
  contatoId = c.id;
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId, contatoId } });
  msg = await prisma.mensagemWhatsApp.create({
    data: { conversaId: conversa.id, numeroId, direcao: "ENTRADA", driver: "MOTOR", corpo: "olá" },
  });
});

describe("dados do motor", () => {
  it("idEvento é único", async () => {
    const base = { tipo: "mensagem.recebida", numeroRef: "n1", ocorridoEm: new Date(), dados: {} };
    await prisma.eventoMotorRecebido.create({ data: { ...base, idEvento: "e-1" } });
    await expect(prisma.eventoMotorRecebido.create({ data: { ...base, idEvento: "e-1" } })).rejects.toMatchObject({ code: "P2002" });
  });

  it("seq cresce na ordem de chegada e o evento nasce pendente", async () => {
    const base = { tipo: "mensagem.recebida", numeroRef: "n1", ocorridoEm: new Date(), dados: {} };
    const a = await prisma.eventoMotorRecebido.create({ data: { ...base, idEvento: "e-a" } });
    const b = await prisma.eventoMotorRecebido.create({ data: { ...base, idEvento: "e-b" } });
    expect(b.seq > a.seq).toBe(true);
    expect(a).toMatchObject({ tentativas: 0, processadoEm: null, proximaTentativaEm: null, resultado: null });
  });

  it("reação é única por mensagem e autor", async () => {
    const r = { mensagemId: msg.id, autorJid: "5511@s.whatsapp.net", deMim: false, emoji: "👍" };
    await prisma.reacaoMensagemWhatsApp.create({ data: r });
    await expect(prisma.reacaoMensagemWhatsApp.create({ data: { ...r, emoji: "❤️" } })).rejects.toMatchObject({ code: "P2002" });
  });

  it("reação bloqueia o delete físico da mensagem (RESTRICT)", async () => {
    await prisma.reacaoMensagemWhatsApp.create({
      data: { mensagemId: msg.id, autorJid: "5511@s.whatsapp.net", deMim: true, emoji: "👍" },
    });
    await expect(prisma.mensagemWhatsApp.delete({ where: { id: msg.id } })).rejects.toMatchObject({ code: "P2003" });
  });

  it("clientMessageId da intenção é único", async () => {
    await novaIntencao("cid-00000001");
    await expect(novaIntencao("cid-00000001")).rejects.toMatchObject({ code: "P2002" });
    await novaIntencao();
    await novaIntencao();
  });

  it("intenção guarda conteúdo especial e mensagem guarda ids do motor", async () => {
    const i = await prisma.intencaoMensagem.create({
      data: { numeroId, contatoId, origem: "HUMANO", corpoRenderizado: "", conteudo: { tipo: "LOCALIZACAO", latitude: 1, longitude: 2 } },
    });
    expect(i.conteudo).toEqual({ tipo: "LOCALIZACAO", latitude: 1, longitude: 2 });
    const agora = new Date();
    const m = await prisma.mensagemWhatsApp.update({
      where: { id: msg.id },
      data: { mensagemIdMotor: "5511@s.whatsapp.net:ABC", editadaEm: agora, apagadaEm: agora },
    });
    expect(m).toMatchObject({ mensagemIdMotor: "5511@s.whatsapp.net:ABC", editadaEm: agora, apagadaEm: agora });
  });
});
