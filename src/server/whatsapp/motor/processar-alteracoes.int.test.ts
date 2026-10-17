import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { PROCESSADORES } from "./receber";
import "./processar-alteracoes";
import type { EnvelopeMotor } from "./eventos";

let numeroId: string;
let conversaId: string;
const OCORRIDO = 1_790_000_000_000;

const processar = (e: EnvelopeMotor) => PROCESSADORES[e.tipo](e);
const envelope = (tipo: string, dados: Record<string, unknown>, ref = numeroId): EnvelopeMotor => ({
  idEvento: "0b9f3c1e-6c1d-4a55-9d3e-2f6f8a1b7c20",
  tipo,
  numeroId: ref,
  ocorridoEm: OCORRIDO,
  dados,
});
const envEdicao = (texto: string, pid = "ABC") => envelope("mensagem.editada", { mensagemId: `x:${pid}`, providerMessageId: pid, texto });
const envApagada = (pid = "ABC") => envelope("mensagem.apagada", { mensagemId: `x:${pid}`, providerMessageId: pid });
const envReacao = (emoji?: string, pid = "ABC") =>
  envelope("mensagem.reacao", { mensagemId: `x:${pid}`, providerMessageId: pid, autorJid: "50688887777@s.whatsapp.net", deMim: false, ...(emoji ? { emoji } : {}) });
const envChamada = (status: string, extra: Record<string, unknown> = {}) =>
  envelope("chamada.recebida", { chamadaId: "CH1", deJid: "50688887777@s.whatsapp.net", telefoneE164: "+50688887777", status, video: false, quando: OCORRIDO, ...extra });

beforeEach(async () => {
  await truncarBanco();
  const n = await prisma.numeroWhatsApp.create({
    data: { telefoneE164: "+5511900000001", rotulo: "Motor", driver: "MOTOR", finalidade: "VENDAS" },
  });
  await prisma.numeroWhatsApp.update({ where: { id: n.id }, data: { providerRef: n.id } });
  numeroId = n.id;
  const c = await prisma.contatoWhatsApp.create({ data: { waId: "50688887777", telefoneE164: "+50688887777", nomeExibicao: "Ana" } as never });
  const conv = await prisma.conversaWhatsApp.create({ data: { numeroId, contatoId: c.id } as never });
  conversaId = conv.id;

  await prisma.mensagemWhatsApp.create({
    data: { numeroId, conversaId, direcao: "ENTRADA", tipo: "TEXTO", corpo: "original", status: "ENTREGUE", driver: "MOTOR", providerMessageId: "ABC" },
  });
});

describe("alterações do motor", () => {
  it("edição atualiza corpo e editadaEm, sem nova mensagem", async () => {
    expect(await processar(envEdicao("corrigido"))).toBe("ok");
    const m = await prisma.mensagemWhatsApp.findUniqueOrThrow({ where: { numeroId_providerMessageId: { numeroId, providerMessageId: "ABC" } } });
    expect(m.corpo).toBe("corrigido");
    expect(m.editadaEm?.getTime()).toBe(OCORRIDO);
    expect(await prisma.mensagemWhatsApp.count()).toBe(1);
  });

  it("edição de mensagem inexistente adia", async () => {
    expect(await processar(envEdicao("x", "NAOEXISTE"))).toEqual({ adiar: "mensagem_inexistente" });
  });

  it("apagada marca apagadaEm e preserva corpo", async () => {
    expect(await processar(envApagada())).toBe("ok");
    const m = await prisma.mensagemWhatsApp.findUniqueOrThrow({ where: { numeroId_providerMessageId: { numeroId, providerMessageId: "ABC" } } });
    expect(m.apagadaEm?.getTime()).toBe(OCORRIDO);
    expect(m.corpo).toBe("original");
    expect(await processar(envApagada("NAOEXISTE"))).toEqual({ adiar: "mensagem_inexistente" });
  });

  it("reação não cria MensagemWhatsApp nem soma naoLidas", async () => {
    expect(await processar(envReacao("👍"))).toBe("ok");
    expect(await prisma.mensagemWhatsApp.count()).toBe(1);
    expect((await prisma.conversaWhatsApp.findUniqueOrThrow({ where: { id: conversaId } })).naoLidas).toBe(0);
    expect(await prisma.reacaoMensagemWhatsApp.count()).toBe(1);
  });

  it("reação repetida é idempotente; troca de emoji atualiza; emoji ausente remove", async () => {
    await processar(envReacao("👍"));
    await processar(envReacao("👍"));
    expect(await prisma.reacaoMensagemWhatsApp.count()).toBe(1);
    await processar(envReacao("❤️"));
    expect((await prisma.reacaoMensagemWhatsApp.findFirstOrThrow()).emoji).toBe("❤️");
    expect(await processar(envReacao())).toBe("ok");
    expect(await prisma.reacaoMensagemWhatsApp.count()).toBe(0);
  });

  it("chamada offer vira CHAMADA uma vez; repetição não duplica; sem somar não lidas", async () => {
    const antes = await prisma.conversaWhatsApp.findUniqueOrThrow({ where: { id: conversaId } });
    expect(await processar(envChamada("offer"))).toBe("ok");
    expect(await processar(envChamada("offer"))).toEqual({ ignorado: "duplicada" });
    const ch = await prisma.mensagemWhatsApp.findMany({ where: { tipo: "CHAMADA" } });
    expect(ch).toHaveLength(1);
    expect(ch[0].providerMessageId).toBe("chamada:CH1");
    expect(ch[0].direcao).toBe("ENTRADA");
    const depois = await prisma.conversaWhatsApp.findUniqueOrThrow({ where: { id: conversaId } });
    expect(depois.naoLidas).toBe(antes.naoLidas);
    expect(depois.ultimoInboundEm).toEqual(antes.ultimoInboundEm);
  });

  it("chamada offer não cancela intenção automática pendente", async () => {
    const c = await prisma.contatoWhatsApp.findFirstOrThrow();
    const i = await prisma.intencaoMensagem.create({
      data: { contatoId: c.id, numeroId, origem: "CRON", status: "PENDENTE", criadaEm: new Date(OCORRIDO - 60_000), clientMessageId: "cid-cron-0001", corpoRenderizado: "lembrete" } as never,
    });
    await processar(envChamada("offer"));
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: i.id } })).status).toBe("PENDENTE");
  });

  it("chamada accept grava 'Atendida no celular'; outros status são ignorados", async () => {
    expect(await processar(envChamada("accept"))).toBe("ok");
    expect((await prisma.mensagemWhatsApp.findFirstOrThrow({ where: { tipo: "CHAMADA" } })).corpo).toBe("Atendida no celular");
    expect(await processar(envChamada("reject", { chamadaId: "CH2" }))).toEqual({ ignorado: "chamada_status" });
    expect(await prisma.mensagemWhatsApp.count({ where: { tipo: "CHAMADA" } })).toBe(1);
  });
});
