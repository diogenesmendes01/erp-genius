import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { medirSaudeCanal } from "./saude";

// Integração E5 (doc 30 · gap A7): a saúde do canal mede a fila POR ESTADO (review
// PR #52) — ADIADA esperando janela é saudável; o alerta é o que VENCEU sem ninguém pegar.

beforeEach(async () => {
  await truncarBanco();
});

async function seedContato(telefone = "+50611112222") {
  return prisma.contatoWhatsApp.create({ data: { telefoneE164: telefone } });
}

async function seedIntencao(
  over: Partial<Parameters<typeof prisma.intencaoMensagem.create>[0]["data"]> = {},
) {
  const { numero } = await seedCanal();
  const contato = await seedContato();
  return prisma.intencaoMensagem.create({
    data: {
      numeroId: numero.id,
      contatoId: contato.id,
      origem: "CRON",
      corpoRenderizado: "degrau",
      ...over,
    } as Parameters<typeof prisma.intencaoMensagem.create>[0]["data"],
  });
}

describe("medirSaudeCanal — fila por estado", () => {
  it("canal vazio e política de fábrica → saudável", async () => {
    const s = await medirSaudeCanal();
    expect(s.ok).toBe(true);
    expect(s.alertas).toEqual([]);
    expect(s.fila).toEqual({
      pendentes: 0,
      adiadas: 0,
      enviando: 0,
      pendenteHaMin: null,
      adiadaVencidaHaMin: null,
      claimExpiradoHaMin: null,
      falhas24h: 0,
    });
    expect(s.ultimoInboundEm).toBeNull();
  });

  it("PENDENTE parada além do limiar → alerta de cron parado", async () => {
    const agora = new Date();
    await seedIntencao({ criadaEm: new Date(agora.getTime() - 8 * 3600_000) });

    const s = await medirSaudeCanal(agora);
    expect(s.ok).toBe(false);
    expect(s.alertas.some((a) => a.includes("PENDENTE há"))).toBe(true);
    expect(s.fila.pendenteHaMin).toBeGreaterThanOrEqual(8 * 60);
  });

  it("ADIADA com despacho no FUTURO é saudável (noite/teto — não é incidente)", async () => {
    const agora = new Date();
    await seedIntencao({
      status: "ADIADA",
      motivoFalha: "fora_da_janela",
      despacharAposEm: new Date(agora.getTime() + 10 * 3600_000), // janela abre amanhã
    });

    const s = await medirSaudeCanal(agora);
    expect(s.ok).toBe(true);
    expect(s.fila.adiadas).toBe(1);
    expect(s.fila.adiadaVencidaHaMin).toBeLessThan(0); // ainda no futuro
  });

  it("ADIADA VENCIDA há horas sem redespachar → alerta", async () => {
    const agora = new Date();
    await seedIntencao({
      status: "ADIADA",
      motivoFalha: "fora_da_janela",
      despacharAposEm: new Date(agora.getTime() - 3 * 3600_000), // venceu há 3h
    });

    const s = await medirSaudeCanal(agora);
    expect(s.ok).toBe(false);
    expect(s.alertas.some((a) => a.includes("ADIADA venceu"))).toBe(true);
  });

  it("claim ENVIANDO expirado sem recuperação → alerta (cron nem recuperou o órfão)", async () => {
    const agora = new Date();
    await seedIntencao({
      status: "ENVIANDO",
      despacharAposEm: new Date(agora.getTime() - 45 * 60_000), // claim venceu há 45min
    });

    const s = await medirSaudeCanal(agora);
    expect(s.ok).toBe(false);
    expect(s.alertas.some((a) => a.includes("claim expirado"))).toBe(true);
    expect(s.fila.claimExpiradoHaMin).toBeGreaterThanOrEqual(45);
  });

  it("kill switch LIGADO: PENDENTE parada é esperada — só o alerta do kill switch dispara", async () => {
    const agora = new Date();
    await seedIntencao({ criadaEm: new Date(agora.getTime() - 8 * 3600_000) });
    await prisma.politicaRegua.updateMany({ data: { killSwitch: true } });

    const s = await medirSaudeCanal(agora);
    expect(s.ok).toBe(false);
    expect(s.alertas).toHaveLength(1);
    expect(s.alertas[0]).toContain("Kill switch");
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

  it("falhas24h conta pela TRANSIÇÃO para FALHOU (atualizadoEm), não pela criação", async () => {
    const agora = new Date();
    // Intenção CRIADA há 3 dias que falhou AGORA: precisa contar.
    const velha = await seedIntencao({ criadaEm: new Date(agora.getTime() - 72 * 3600_000) });
    await prisma.intencaoMensagem.update({
      where: { id: velha.id },
      data: { status: "FALHOU", motivoFalha: "meta_api" }, // @updatedAt marca a transição
    });

    const s = await medirSaudeCanal(agora);
    expect(s.fila.falhas24h).toBe(1);
    expect(s.alertas.some((a) => a.includes("falharam"))).toBe(true);

    // Falha ANTIGA (transição há 2 dias) não conta: envelhece o atualizadoEm por SQL cru
    // (o client sobrescreveria o @updatedAt).
    await prisma.$executeRaw`UPDATE "IntencaoMensagem" SET "atualizadoEm" = ${new Date(
      agora.getTime() - 48 * 3600_000,
    )} WHERE "id" = ${velha.id}`;
    const depois = await medirSaudeCanal(agora);
    expect(depois.fila.falhas24h).toBe(0);
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
