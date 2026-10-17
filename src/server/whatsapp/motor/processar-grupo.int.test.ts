import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";

const executar = vi.fn();
vi.mock("./acoes", () => ({ executarAcaoMotor: (...a: unknown[]) => executar(...a) }));
vi.mock("./config", () => ({ lerConfigMotor: () => ({ url: "http://motor.teste", apiKey: "k".repeat(32), segredoWebhook: "s".repeat(32) }) }));

import { PROCESSADORES } from "./receber";
import "./processar-mensagem";
import "./processar-grupo";
import type { EnvelopeMotor } from "./eventos";

const GRUPO = "120363000000000001@g.us";
const PART = "50688887777@s.whatsapp.net";
let numeroId: string;

function env(tipo: string, dados: Record<string, unknown>): EnvelopeMotor {
  return { idEvento: "0b9f3c1e-6c1d-4a55-9d3e-2f6f8a1b7c30", tipo, numeroId, ocorridoEm: 1_790_000_000_000, dados };
}
const msgGrupo = (extra: Record<string, unknown> = {}) => ({
  mensagemId: `${GRUPO}:G1`,
  providerMessageId: "G1",
  chatJid: GRUPO,
  ehGrupo: true,
  direcao: "ENTRADA",
  participante: { jid: PART, telefoneE164: "+50688887777", nomePerfil: "Ana" },
  tipo: "TEXTO",
  tipoMotor: "text",
  texto: "bom dia, turma",
  quando: 1_790_000_000_000,
  ...extra,
});

beforeEach(async () => {
  await truncarBanco();
  executar.mockReset();
  const n = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511900000001", rotulo: "Motor", driver: "MOTOR", finalidade: "VENDAS" } });
  await prisma.numeroWhatsApp.update({ where: { id: n.id }, data: { providerRef: n.id } });
  numeroId = n.id;
});

describe("grupos do motor", () => {
  it("mensagem de grupo grava participante e não abre atendimento", async () => {
    expect(await PROCESSADORES["mensagem.recebida"](env("mensagem.recebida", msgGrupo()))).toBe("ok");
    const grupo = await prisma.grupoWhatsApp.findFirstOrThrow();
    expect(grupo).toMatchObject({ grupoJid: GRUPO, nome: GRUPO, numeroId });
    const conversa = await prisma.conversaWhatsApp.findFirstOrThrow();
    expect(conversa).toMatchObject({ grupoId: grupo.id, contatoId: null, naoLidas: 1 });
    const m = await prisma.mensagemWhatsApp.findFirstOrThrow();
    expect(m).toMatchObject({
      conversaId: conversa.id, direcao: "ENTRADA", corpo: "bom dia, turma", atendimentoId: null,
      participanteJid: PART, participanteE164: "+50688887777", participanteNome: "Ana", driver: "MOTOR",
    });
    expect(await prisma.atendimentoWhatsApp.count()).toBe(0);
    expect(await prisma.contatoWhatsApp.count()).toBe(0);
    // repetição e segunda mensagem reaproveitam grupo e conversa
    expect(await PROCESSADORES["mensagem.recebida"](env("mensagem.recebida", msgGrupo()))).toEqual({ ignorado: "duplicada" });
    await PROCESSADORES["mensagem.recebida"](env("mensagem.recebida", msgGrupo({ providerMessageId: "G2", mensagemId: `${GRUPO}:G2` })));
    expect(await prisma.grupoWhatsApp.count()).toBe(1);
    expect(await prisma.conversaWhatsApp.count()).toBe(1);
    expect(await prisma.mensagemWhatsApp.count()).toBe(2);
  });

  it("mensagem de grupo não cancela intenção CRON pendente do participante nem registra opt-out", async () => {
    const c = await prisma.contatoWhatsApp.create({ data: { waId: "50688887777", telefoneE164: "+50688887777" } as never });
    const i = await prisma.intencaoMensagem.create({
      data: { contatoId: c.id, numeroId, origem: "CRON", status: "PENDENTE", criadaEm: new Date(1_790_000_000_000 - 60_000), clientMessageId: "cid-cron-0001", corpoRenderizado: "lembrete" } as never,
    });
    await PROCESSADORES["mensagem.recebida"](env("mensagem.recebida", msgGrupo({ texto: "PARAR" })));
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: i.id } })).status).toBe("PENDENTE");
    expect((await prisma.contatoWhatsApp.findUniqueOrThrow({ where: { id: c.id } })).optOutEm).toBeNull();
  });

  it("eco do celular em grupo grava SAIDA CELULAR", async () => {
    const r = await PROCESSADORES["mensagem.enviada"](env("mensagem.enviada", msgGrupo({ direcao: "SAIDA", origem: "celular", participante: null, texto: "aviso" })));
    expect(r).toBe("ok");
    const m = await prisma.mensagemWhatsApp.findFirstOrThrow();
    expect(m).toMatchObject({ direcao: "SAIDA", origem: "CELULAR", status: "ENVIADA", corpo: "aviso" });
    expect((await prisma.conversaWhatsApp.findFirstOrThrow()).naoLidas).toBe(0);
  });

  it("grupo.atualizado atualiza o nome", async () => {
    await PROCESSADORES["mensagem.recebida"](env("mensagem.recebida", msgGrupo()));
    executar.mockResolvedValue({ subject: "Turma B1" });
    expect(await PROCESSADORES["grupo.atualizado"](env("grupo.atualizado", { grupoJid: GRUPO }))).toBe("ok");
    expect(executar).toHaveBeenCalledWith(numeroId, "group.details", { id: GRUPO });
    expect((await prisma.grupoWhatsApp.findFirstOrThrow()).nome).toBe("Turma B1");
  });

  it("grupo.atualizado de grupo desconhecido não consulta o motor", async () => {
    expect(await PROCESSADORES["grupo.atualizado"](env("grupo.atualizado", { grupoJid: GRUPO }))).toEqual({ ignorado: "grupo_desconhecido" });
    expect(executar).not.toHaveBeenCalled();
  });
});
