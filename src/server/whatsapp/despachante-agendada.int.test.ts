import { DriverWhatsApp, Papel } from "@prisma/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import { despacharFila, MOTIVO_AGUARDA_CONFIRMACAO } from "./despachante";

beforeEach(async () => {
  await truncarBanco();
  vi.stubEnv("WHATSAPP_LIVE", "0");
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

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
  async function retida(opcoes: { perguntar: boolean; entradaMs: number; confirmadaMs?: number; anexo?: boolean; vinculo?: boolean }) {
    const agora = new Date();
    const criadaEm = new Date(agora.getTime() - 3600_000);
    const vend = await criarUsuario([Papel.VENDEDOR], "Vend");
    const numero = await criarNumeroSetor({ telefoneE164: "+5511955550102", setores: ["COMERCIAL"], donoId: vend.id });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688887778" } });
    const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: vend.id }));
    const ultimoInboundEm = new Date(criadaEm.getTime() + opcoes.entradaMs);
    await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { ultimoInboundEm } });
    await prisma.conversaWhatsApp.update({ where: { numeroId_contatoId: { numeroId: numero.id, contatoId: contato.id } }, data: { ultimoInboundEm } });
    const lead = opcoes.vinculo ? await prisma.oportunidade.create({ data: { nome: "Lead375", vendedorDonoId: vend.id } }) : null;
    const tarefa = lead ? await prisma.tarefa.create({ data: { titulo: "Ligar para o lead", tipo: "LIGACAO", setor: "COMERCIAL", fusoOrigem: "America/Sao_Paulo", responsavelId: vend.id, leadId: lead.id } }) : null;
    const it = await prisma.intencaoMensagem.create({
      data: {
        numeroId: numero.id, contatoId: contato.id, atendimentoId: a.id, autorId: vend.id, origem: "HUMANO", corpoRenderizado: "Oi", criadaEm,
        ...(opcoes.anexo ? { tipo: "DOCUMENTO" as const, midiaPath: `/api/files/whatsapp-out/${vend.id}/proposta375.pdf` } : {}),
        leadId: lead?.id ?? null, tarefaId: tarefa?.id ?? null,
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

  it("agendada com anexo e a opção: entrada depois de agendar retém a mídia sem enviar", async () => {
    const { agora, it: m } = await retida({ perguntar: true, entradaMs: 60_000, anexo: true });
    expect(await despacharFila(agora, { intencaoId: m.id })).toMatchObject({ adiadas: 1, simuladas: 0, despachadas: 0 });
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: m.id } })).toMatchObject({ status: "ADIADA", motivoFalha: MOTIVO_AGUARDA_CONFIRMACAO, tipo: "DOCUMENTO", midiaPath: m.midiaPath });
  });

  it("agendada com vínculo a oportunidade e tarefa sai normalmente e preserva o vínculo", async () => {
    const { agora, it: m } = await retida({ perguntar: false, entradaMs: 60_000, vinculo: true });
    expect(m.leadId).not.toBeNull();expect(m.tarefaId).not.toBeNull();
    expect((await despacharFila(agora, { intencaoId: m.id })).simuladas).toBe(1);
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: m.id } })).toMatchObject({ status: "SIMULADA", leadId: m.leadId, tarefaId: m.tarefaId });
  });

  it("MANTER concorrente antes da retenção: não conta adiada nem cancelada e a linha segue como o MANTER deixou", async () => {
    const { agora, it: m } = await retida({ perguntar: true, entradaMs: 60_000 });
    const confirmadaEm = new Date(agora.getTime() - 1000);
    const original = prisma.intencaoMensagem.updateMany.bind(prisma.intencaoMensagem);
    vi.spyOn(prisma.intencaoMensagem, "updateMany").mockImplementation((async (args: Parameters<typeof original>[0]) => {
      if (args.data && (args.data as { motivoFalha?: unknown }).motivoFalha === MOTIVO_AGUARDA_CONFIRMACAO) {
        await prisma.intencaoMensagem.update({ where: { id: m.id }, data: { confirmadaAposRespostaEm: confirmadaEm } });
      }
      return original(args);
    }) as unknown as typeof original);
    const r = await despacharFila(agora, { intencaoId: m.id });
    expect(r).toMatchObject({ avaliadas: 1, adiadas: 0, canceladas: 0, simuladas: 0 });
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: m.id } })).toMatchObject({ status: "PENDENTE", confirmadaAposRespostaEm: confirmadaEm, motivoFalha: null });
  });
});
