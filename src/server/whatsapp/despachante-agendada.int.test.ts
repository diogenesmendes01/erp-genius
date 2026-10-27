import { DriverWhatsApp } from "@prisma/client";
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { despacharFila, MOTIVO_AGUARDA_CONFIRMACAO } from "./despachante";

beforeEach(async () => {
  await truncarBanco();
});

async function seed(agendadaPara: Date | null, status: "PENDENTE" | "ADIADA" = "PENDENTE") {
  const numero = await prisma.numeroWhatsApp.create({
    data: { telefoneE164: "+5511955550101", rotulo: "Vendas", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS", providerRef: "inst-da" },
  });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688887777" } });
  return prisma.intencaoMensagem.create({
    data: {
      numeroId: numero.id, contatoId: contato.id, origem: "HUMANO", corpoRenderizado: "Oi", agendadaPara, status,
      despacharAposEm: status === "ADIADA" ? new Date(Date.now() - 60_000) : null,
    },
  });
}

describe("despachante × mensagem agendada", () => {
  it("despachante não pega PENDENTE com agendadaPara no futuro", async () => {
    const agora = new Date();
    const futura = await seed(new Date(agora.getTime() + 3600_000));
    const r = await despacharFila(agora, { intencaoId: futura.id });
    expect(r.avaliadas).toBe(0);
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: futura.id } })).status).toBe("PENDENTE");
  });

  it("ADIADA vencida com agendadaPara no futuro também espera", async () => {
    const agora = new Date();
    const futura = await seed(new Date(agora.getTime() + 3600_000), "ADIADA");
    const r = await despacharFila(agora, { intencaoId: futura.id });
    expect(r.avaliadas).toBe(0);
  });

  it("agendadaPara vencida ou nula entra na fila", async () => {
    const agora = new Date();
    const vencida = await seed(new Date(agora.getTime() - 60_000));
    expect((await despacharFila(agora, { intencaoId: vencida.id })).avaliadas).toBe(1);
  });
});

describe("despachante × perguntar se o contato responder", () => {
  async function retida(opcoes: { perguntar: boolean; entradaMs: number; confirmadaMs?: number }) {
    const agora = new Date();
    const criadaEm = new Date(agora.getTime() - 3600_000);
    const numero = await prisma.numeroWhatsApp.create({
      data: { telefoneE164: "+5511955550102", rotulo: "Vendas", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS", providerRef: "inst-da2" },
    });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688887778" } });
    await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: contato.id, ultimoInboundEm: new Date(criadaEm.getTime() + opcoes.entradaMs) } });
    const it = await prisma.intencaoMensagem.create({
      data: {
        numeroId: numero.id, contatoId: contato.id, origem: "HUMANO", corpoRenderizado: "Oi", criadaEm,
        agendadaPara: new Date(agora.getTime() - 60_000), perguntarSeResponder: opcoes.perguntar,
        confirmadaAposRespostaEm: opcoes.confirmadaMs === undefined ? null : new Date(criadaEm.getTime() + opcoes.confirmadaMs),
      },
    });
    return { agora, it };
  }

  it("com a opção, entrada depois de agendar retém a mensagem: ADIADA aguarda_confirmacao_resposta e não envia", async () => {
    const { agora, it: m } = await retida({ perguntar: true, entradaMs: 60_000 });
    const r = await despacharFila(agora, { intencaoId: m.id });
    expect(r).toMatchObject({ adiadas: 1, simuladas: 0, despachadas: 0 });
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: m.id } })).toMatchObject({ status: "ADIADA", motivoFalha: MOTIVO_AGUARDA_CONFIRMACAO, despacharAposEm: null, despachadaEm: null });
    expect((await despacharFila(new Date(agora.getTime() + 3600_000), { intencaoId: m.id })).avaliadas).toBe(0);
  });

  it("sem a opção, sai normalmente (HUMANO não cai na lei da conversa viva)", async () => {
    const { agora, it: m } = await retida({ perguntar: false, entradaMs: 60_000 });
    expect((await despacharFila(agora, { intencaoId: m.id })).simuladas).toBe(1);
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("SIMULADA");
  });

  it("entrada antes de agendar não retém", async () => {
    const { agora, it: m } = await retida({ perguntar: true, entradaMs: -60_000 });
    expect((await despacharFila(agora, { intencaoId: m.id })).simuladas).toBe(1);
  });

  it("confirmada depois da entrada não retém", async () => {
    const { agora, it: m } = await retida({ perguntar: true, entradaMs: 60_000, confirmadaMs: 120_000 });
    expect((await despacharFila(agora, { intencaoId: m.id })).simuladas).toBe(1);
  });
});
