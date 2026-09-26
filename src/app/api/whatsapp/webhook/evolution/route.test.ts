import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ mensagem: vi.fn(), status: vi.fn(), historico: vi.fn(), sessao: vi.fn(), updateMany: vi.fn(), baixar: vi.fn(), salvar: vi.fn() }));
vi.mock("@/server/whatsapp/inbound", () => ({ processarMensagemNormalizada: m.mensagem, processarStatusNormalizado: m.status }));
vi.mock("@/server/whatsapp/historico", () => ({ importarHistoricoLinha: m.historico }));
vi.mock("@/server/whatsapp/sessao", () => ({ aplicarEstadoSessaoPorInstancia: m.sessao }));
vi.mock("@/server/whatsapp/midia", () => ({ baixarMidiaEvolution: m.baixar, salvarMidiaInbound: m.salvar }));
vi.mock("@/lib/prisma", () => ({ prisma: { numeroWhatsApp: { updateMany: m.updateMany } } }));

import { POST } from "./route";

// Webhook Evolution — SPEC-ERP-005 Fase 0 (contato por LID) e Fase 3 (histórico do aparelho).

const TOKEN = "token-teste";
const post = (corpo: unknown, token = TOKEN) =>
  POST(new Request("https://example.test/api/whatsapp/webhook/evolution", { method: "POST", headers: { apikey: token }, body: JSON.stringify(corpo) }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("EVOLUTION_WEBHOOK_TOKEN", TOKEN);
  m.historico.mockResolvedValue({ gravadas: 0, ignoradas: 0, motivo: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("webhook Evolution — mensagens em tempo real", () => {
  it("recusa token errado antes de qualquer processamento", async () => {
    expect((await post({ event: "messages.upsert" }, "errado")).status).toBe(401);
    expect(m.mensagem).not.toHaveBeenCalled();
  });

  it("conversa 1:1 por telefone é ingerida como antes", async () => {
    await post({ event: "messages.upsert", instance: "linha-a", data: {
      key: { remoteJid: "50688887777@s.whatsapp.net", fromMe: false, id: "M1" }, pushName: "Ana", message: { conversation: "oi" }, messageTimestamp: 1_790_000_000,
    } });
    expect(m.mensagem).toHaveBeenCalledWith(expect.objectContaining({
      numeroProviderRef: "linha-a", contatoWaId: "50688887777", providerMessageId: "M1", corpo: "oi", tipo: "TEXTO", fromMe: false,
      quando: new Date(1_790_000_000_000),
    }));
  });

  it("Fase 0: contato por LID entra pelo telefone alternativo (antes era descartado em silêncio)", async () => {
    await post({ event: "messages.upsert", instance: "linha-a", data: {
      key: { remoteJid: "123456789012345@lid", remoteJidAlt: "50688887777@s.whatsapp.net", fromMe: false, id: "M2" }, message: { conversation: "sou novo" },
    } });
    expect(m.mensagem).toHaveBeenCalledWith(expect.objectContaining({ contatoWaId: "50688887777", providerMessageId: "M2" }));
  });

  it("LID sem telefone não grava e registra o descarte sem telefone nem conteúdo", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    await post({ event: "messages.upsert", instance: "linha-a", data: { key: { remoteJid: "123456789012345@lid", id: "M3" }, message: { conversation: "segredo" } } });
    expect(m.mensagem).not.toHaveBeenCalled();
    expect(aviso).toHaveBeenCalledWith("[webhook evolution] mensagem descartada", { evento: "messages.upsert", instancia: "linha-a", motivo: "lid_sem_telefone" });
    expect(JSON.stringify(aviso.mock.calls)).not.toContain("segredo");
    aviso.mockRestore();
  });

  it("LC-14: grupo, status e broadcast nunca entram e não poluem o log", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const remoteJid of ["1203630@g.us", "status@broadcast", "99@broadcast"]) {
      await post({ event: "messages.upsert", instance: "linha-a", data: { key: { remoteJid, id: `G-${remoteJid}` }, message: { conversation: "x" } } });
    }
    expect(m.mensagem).not.toHaveBeenCalled();
    expect(aviso).not.toHaveBeenCalled();
    aviso.mockRestore();
  });

  it("ack de mensagem endereçada por LID ainda atualiza o status (a mensagem é achada pelo id)", async () => {
    await post({ event: "messages.update", instance: "linha-a", data: { key: { remoteJid: "123456789012345@lid", id: "M4" }, ack: 3 } });
    expect(m.status).toHaveBeenCalledWith(expect.objectContaining({ providerMessageId: "M4", status: "LIDA" }));
  });
});

describe("webhook Evolution — histórico do aparelho (Fase 3)", () => {
  it("messages.set vai para a importação sem efeitos, com LID resolvido e grupos fora", async () => {
    await post({ event: "messages.set", instance: "linha-a", data: [
      { key: { remoteJid: "50688887777@s.whatsapp.net", fromMe: false, id: "H1" }, pushName: "Ana", message: { conversation: "antiga" }, messageTimestamp: 1_790_000_000 },
      { key: { remoteJid: "777@lid", remoteJidAlt: "50611112222@s.whatsapp.net", fromMe: true, id: "H2" }, message: { imageMessage: { caption: "foto" } }, messageTimestamp: 1_790_000_100 },
      { key: { remoteJid: "1203630@g.us", id: "H3" }, message: { conversation: "grupo" } },
    ] });
    expect(m.mensagem).not.toHaveBeenCalled(); // nada passa pelo fluxo de conversa viva
    expect(m.historico).toHaveBeenCalledWith({ numeroProviderRef: "linha-a" }, [
      { contatoWaId: "50688887777", nomeExibicao: "Ana", providerMessageId: "H1", corpo: "antiga", tipo: "TEXTO", fromMe: false, quando: new Date(1_790_000_000_000) },
      { contatoWaId: "50611112222", nomeExibicao: null, providerMessageId: "H2", corpo: "foto", tipo: "IMAGEM", fromMe: true, quando: new Date(1_790_000_100_000) },
    ]);
  });

  it("aceita o formato { messages: [...] } e ignora evento sem instância", async () => {
    await post({ event: "messages.set", instance: "linha-a", data: { messages: [
      { key: { remoteJid: "50688887777@s.whatsapp.net", id: "H4" }, message: { conversation: "x" }, messageTimestamp: 1 },
    ] } });
    expect(m.historico).toHaveBeenCalledWith({ numeroProviderRef: "linha-a" }, [expect.objectContaining({ providerMessageId: "H4" })]);
    m.historico.mockClear();
    await post({ event: "messages.set", data: [] });
    expect(m.historico).not.toHaveBeenCalled();
  });
});
