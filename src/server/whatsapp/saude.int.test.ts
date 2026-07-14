import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { medirSaudeCanal } from "./saude";

// Integração E5 (doc 30 · gap A7): a saúde do canal lê o estado operacional real —
// fila que não drena, sessão caída, falhas e kill switch viram alertas legíveis.

beforeEach(async () => {
  await truncarBanco();
});

async function seedContato(telefone = "+50611112222") {
  return prisma.contatoWhatsApp.create({ data: { telefoneE164: telefone } });
}

describe("medirSaudeCanal", () => {
  it("canal vazio e política de fábrica → saudável", async () => {
    const s = await medirSaudeCanal();
    expect(s.ok).toBe(true);
    expect(s.alertas).toEqual([]);
    expect(s.fila).toEqual({ pendentes: 0, adiadas: 0, enviando: 0, maisAntigaMin: null, falhas24h: 0 });
    expect(s.ultimoInboundEm).toBeNull();
  });

  it("item parado na fila além do limiar → alerta de cron parado", async () => {
    const { numero } = await seedCanal();
    const contato = await seedContato();
    const agora = new Date();
    await prisma.intencaoMensagem.create({
      data: {
        numeroId: numero.id,
        contatoId: contato.id,
        origem: "CRON",
        corpoRenderizado: "degrau",
        criadaEm: new Date(agora.getTime() - 8 * 3600_000), // 8h > limiar de 6h
      },
    });

    const s = await medirSaudeCanal(agora);
    expect(s.ok).toBe(false);
    expect(s.alertas.some((a) => a.includes("mais velho na fila"))).toBe(true);
    expect(s.fila.pendentes).toBe(1);
    expect(s.fila.maisAntigaMin).toBeGreaterThanOrEqual(8 * 60);
  });

  it("item recente na fila NÃO alerta (aguardar janela é normal)", async () => {
    const { numero } = await seedCanal();
    const contato = await seedContato();
    await prisma.intencaoMensagem.create({
      data: { numeroId: numero.id, contatoId: contato.id, origem: "CRON", corpoRenderizado: "x", status: "ADIADA" },
    });
    const s = await medirSaudeCanal();
    expect(s.ok).toBe(true);
    expect(s.fila.adiadas).toBe(1);
  });

  it("sessão Baileys caída em número ativo → alerta; número inativo não conta", async () => {
    await prisma.numeroWhatsApp.create({
      data: { telefoneE164: "+5511911110000", rotulo: "Vendas", driver: "BAILEYS", finalidade: "VENDAS", sessao: "CAIU" },
    });
    await prisma.numeroWhatsApp.create({
      data: {
        telefoneE164: "+5511922220000",
        rotulo: "Antigo",
        driver: "BAILEYS",
        finalidade: "VENDAS",
        sessao: "CAIU",
        ativo: false,
      },
    });

    const s = await medirSaudeCanal();
    expect(s.ok).toBe(false);
    expect(s.alertas.filter((a) => a.includes("caiu"))).toHaveLength(1);
    expect(s.alertas[0]).toContain("Vendas");
  });

  it("falhas nas últimas 24h e kill switch → alertas próprios", async () => {
    const { numero, politica } = await seedCanal();
    await prisma.politicaRegua.update({ where: { id: politica.id }, data: { killSwitch: true } });
    const contato = await seedContato();
    await prisma.intencaoMensagem.create({
      data: {
        numeroId: numero.id,
        contatoId: contato.id,
        origem: "CRON",
        corpoRenderizado: "x",
        status: "FALHOU",
        motivoFalha: "meta_api",
      },
    });

    const s = await medirSaudeCanal();
    expect(s.ok).toBe(false);
    expect(s.alertas.some((a) => a.includes("falharam"))).toBe(true);
    expect(s.alertas.some((a) => a.includes("Kill switch"))).toBe(true);
    expect(s.fila.falhas24h).toBe(1);
    expect(s.politica?.killSwitch).toBe(true);
  });

  it("último inbound aparece (webhook vivo)", async () => {
    const { numero } = await seedCanal();
    const contato = await seedContato();
    const conversa = await prisma.conversaWhatsApp.create({
      data: { numeroId: numero.id, contatoId: contato.id },
    });
    await prisma.mensagemWhatsApp.create({
      data: {
        conversaId: conversa.id,
        numeroId: numero.id,
        direcao: "ENTRADA",
        corpo: "oi",
        driver: "META_CLOUD",
        providerMessageId: "MSG-SAUDE-1",
      },
    });

    const s = await medirSaudeCanal();
    expect(s.ultimoInboundEm).not.toBeNull();
  });
});
