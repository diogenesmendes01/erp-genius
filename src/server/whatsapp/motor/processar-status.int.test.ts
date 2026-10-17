import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { PROCESSADORES } from "./receber";
import "./processar-status";
import type { EnvelopeMotor } from "./eventos";

const processar = (e: EnvelopeMotor) => PROCESSADORES["mensagem.status"](e);
let numeroId: string;
let conversaId: string;
let contatoId: string;
const OCORRIDO = 1_790_000_000_000;

function envStatus(status: string, extra: Record<string, unknown> = {}, ref = numeroId): EnvelopeMotor {
  return {
    idEvento: "0b9f3c1e-6c1d-4a55-9d3e-2f6f8a1b7c11",
    tipo: "mensagem.status",
    numeroId: ref,
    ocorridoEm: OCORRIDO,
    dados: { providerMessageId: "X", status, ...extra },
  };
}

async function criarMensagem(data: Record<string, unknown> = {}) {
  return prisma.mensagemWhatsApp.create({
    data: {
      numeroId,
      conversaId,
      direcao: "SAIDA",
      tipo: "TEXTO",
      corpo: "oi",
      status: "ENVIADA",
      driver: "MOTOR",
      origem: "HUMANO",
      providerMessageId: "X",
      ...data,
    } as never,
  });
}

beforeEach(async () => {
  await truncarBanco();
  const n = await prisma.numeroWhatsApp.create({
    data: { telefoneE164: "+5511900000001", rotulo: "Motor", driver: "MOTOR", finalidade: "VENDAS" },
  });
  await prisma.numeroWhatsApp.update({ where: { id: n.id }, data: { providerRef: n.id } });
  numeroId = n.id;
  const c = await prisma.contatoWhatsApp.create({ data: { waId: "50688887777", telefoneE164: "+50688887777", nomeExibicao: "Ana" } as never });
  contatoId = c.id;
  const conv = await prisma.conversaWhatsApp.create({ data: { numeroId, contatoId } as never });
  conversaId = conv.id;
});

describe("mensagem.status", () => {
  it("ENTREGUE atualiza status e statusEm = ocorridoEm", async () => {
    const m = await criarMensagem();
    expect(await processar(envStatus("ENTREGUE"))).toBe("ok");
    const r = await prisma.mensagemWhatsApp.findUniqueOrThrow({ where: { id: m.id } });
    expect(r.status).toBe("ENTREGUE");
    expect(r.statusEm?.getTime()).toBe(OCORRIDO);
  });

  it("dados.quando tem precedência sobre ocorridoEm", async () => {
    const m = await criarMensagem();
    await processar(envStatus("ENTREGUE", { quando: OCORRIDO - 5000 }));
    const r = await prisma.mensagemWhatsApp.findUniqueOrThrow({ where: { id: m.id } });
    expect(r.statusEm?.getTime()).toBe(OCORRIDO - 5000);
  });

  it("status órfão adia e aplica depois", async () => {
    expect(await processar(envStatus("ENTREGUE", { providerMessageId: "X" }))).toEqual({ adiar: "status_sem_mensagem" });
    const m = await criarMensagem();
    expect(await processar(envStatus("ENTREGUE", { providerMessageId: "X" }))).toBe("ok");
    expect((await prisma.mensagemWhatsApp.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("ENTREGUE");
  });

  it("acha pela clientMessageId quando providerMessageId difere", async () => {
    const m = await criarMensagem({ providerMessageId: null, clientMessageId: "cid-1" });
    expect(await processar(envStatus("LIDA", { providerMessageId: "OUTRO", clientMessageId: "cid-1" }))).toBe("ok");
    expect((await prisma.mensagemWhatsApp.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("LIDA");
  });

  it("LIDA não regride para ENTREGUE", async () => {
    const m = await criarMensagem({ status: "LIDA" });
    const r = await processar(envStatus("ENTREGUE"));
    expect(r).toEqual({ ignorado: "sem_progresso" });
    expect((await prisma.mensagemWhatsApp.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("LIDA");
  });

  it("número desconhecido é ignorado, não adiado", async () => {
    expect(await processar(envStatus("ENTREGUE", {}, "nao-existe"))).toEqual({ ignorado: "numero_desconhecido" });
  });

  it("FALHOU grava EntregaWhatsAppFalhou", async () => {
    const m = await criarMensagem();
    expect(await processar(envStatus("FALHOU", { motivo: "numero_invalido" }))).toBe("ok");
    expect((await prisma.mensagemWhatsApp.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("FALHOU");
    const evs = await prisma.evento.findMany({ where: { tipo: "EntregaWhatsAppFalhou" } });
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ agregadoTipo: "NumeroWhatsApp", agregadoId: numeroId });
    expect(evs[0].payload).toMatchObject({ mensagemId: m.id, motivo: "numero_invalido" });
    // reentrega não duplica
    await processar(envStatus("FALHOU"));
    expect(await prisma.evento.count({ where: { tipo: "EntregaWhatsAppFalhou" } })).toBe(1);
  });

  it("FALHOU de mensagem com intenção usa o agregado IntencaoMensagem", async () => {
    const i = await prisma.intencaoMensagem.create({
      data: { numeroId, contatoId, origem: "HUMANO", corpoRenderizado: "oi", status: "DESPACHADA", clientMessageId: "cid-2" } as never,
    });
    await criarMensagem({ clientMessageId: "cid-2", intencao: { connect: { id: i.id } } });
    await processar(envStatus("FALHOU"));
    const ev = await prisma.evento.findFirstOrThrow({ where: { tipo: "EntregaWhatsAppFalhou" } });
    expect(ev).toMatchObject({ agregadoTipo: "IntencaoMensagem", agregadoId: i.id });
  });
});
