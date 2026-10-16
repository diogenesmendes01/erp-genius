import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario } from "@/test/integracao";
import { processarMensagemNormalizada } from "@/server/whatsapp/inbound";

// Integração E1: o inbound não captura lead nem saúda (casca do CRM antigo removida), mesmo
// com a ConfigComercial antiga ligada. Resta a trava S1 do despachante.

let dono: Awaited<ReturnType<typeof criarUsuario>>;

beforeEach(async () => {
  await truncarBanco();
  dono = await criarUsuario([]); // dono do número de vendas
});

async function seedNumeroVendas() {
  return prisma.numeroWhatsApp.create({
    data: {
      telefoneE164: "+5511988887777",
      rotulo: "Vendas — teste",
      driver: "BAILEYS",
      finalidade: "VENDAS",
      providerRef: "inst-vendas",
      donoId: dono.id,
    },
  });
}

async function ligarConfig(
  over: { autoLeadAtivo?: boolean; saudacaoEstado?: "DESLIGADA" | "SHADOW" | "ATIVA" } = {},
) {
  const data = { autoLeadAtivo: over.autoLeadAtivo ?? false, saudacaoEstado: over.saudacaoEstado ?? ("DESLIGADA" as const) };
  return prisma.configComercial.upsert({
    where: { id: "comercial" },
    create: { id: "comercial", ...data },
    update: data,
  });
}

async function inbound(numero: { providerRef: string | null }, over: Partial<Parameters<typeof processarMensagemNormalizada>[0]> = {}) {
  return processarMensagemNormalizada({
    numeroProviderRef: numero.providerRef,
    contatoWaId: "5511970001111",
    nomeExibicao: "Maria Lead",
    providerMessageId: `MSG-${Math.random().toString(36).slice(2)}`,
    corpo: "Olá, quero informações",
    tipo: "TEXTO",
    driver: "BAILEYS",
    fromMe: false,
    quando: new Date(),
    ...over,
  });
}

describe("casca removida (E1): o 1º inbound não captura lead nem saúda", () => {
  it("config antiga ligada + número VENDAS → mensagem gravada, sem lead e sem intenção; capturadaEm marcado", async () => {
    const numero = await seedNumeroVendas();
    await ligarConfig({ autoLeadAtivo: true, saudacaoEstado: "ATIVA" });
    expect(await inbound(numero, { referral: { sourceType: "ad", sourceId: "ad-1" } })).toBe("gravada");
    expect(await prisma.lead.count()).toBe(0);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
    expect((await prisma.contatoWhatsApp.findFirstOrThrow()).leadId).toBeNull();
    expect((await prisma.conversaWhatsApp.findFirstOrThrow()).capturadaEm).not.toBeNull();
  });
  it("telefone que já é lead: o contato não é vinculado automaticamente", async () => {
    const numero = await seedNumeroVendas();
    await ligarConfig({ autoLeadAtivo: true });
    await prisma.lead.create({ data: { nome: "Já lead", telefoneE164: "+5511970001111" } });
    await inbound(numero);
    expect((await prisma.contatoWhatsApp.findFirstOrThrow()).leadId).toBeNull();
  });
});

describe("trava S1 do despachante", () => {
  it("contraste: automação CRON NÃO-reativa no mesmo número Baileys é CANCELADA pela trava S1", async () => {
    const numero = await seedNumeroVendas();
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+5511970002222" } });
    await prisma.intencaoMensagem.create({
      data: { numeroId: numero.id, contatoId: contato.id, origem: "CRON", corpoRenderizado: "auto não-reativa" },
    });
    const { despacharFila } = await import("@/server/whatsapp/despachante");
    await despacharFila();
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow({ where: { contatoId: contato.id } });
    expect(intencao.status).toBe("CANCELADA");
    expect(intencao.motivoFalha).toBe("trava_driver_oficial");
  });
});
