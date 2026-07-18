import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo, seedCatalogoMinimo } from "@/test/integracao";
import { processarMensagemNormalizada } from "@/server/whatsapp/inbound";

// Integração E6/C1 (doc 27): auto-captura de lead + saudação reativa no 1º inbound de um
// número de VENDAS. Toggles independentes na ConfigComercial (nascem desligados); dedupe
// por telefone (gap 17); saudação isenta de janela/trava S1 (classe reativa, gap C20).
// Ambiente sem WHATSAPP_LIVE → o despacho da saudação vira SIMULADA (nunca envia de verdade).

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

async function ligarConfig(over: { autoLeadAtivo?: boolean; saudacaoAtiva?: boolean } = {}) {
  return prisma.configComercial.upsert({
    where: { id: "comercial" },
    create: { id: "comercial", autoLeadAtivo: over.autoLeadAtivo ?? false, saudacaoAtiva: over.saudacaoAtiva ?? false },
    update: { autoLeadAtivo: over.autoLeadAtivo ?? false, saudacaoAtiva: over.saudacaoAtiva ?? false },
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

describe("auto-lead (gap 17 dedupe)", () => {
  it("config ligada + 1º inbound de telefone desconhecido → cria lead com dono e origem do referral", async () => {
    const numero = await seedNumeroVendas();
    await ligarConfig({ autoLeadAtivo: true });

    const r = await inbound(numero, {
      referral: { campanha: "Promo Julho", conjunto: "FB_ADS", anuncio: "ad-123", palavra: "clid-xyz" },
    });
    expect(r).toBe("gravada");

    const lead = await prisma.lead.findFirstOrThrow();
    expect(lead.codigo).toMatch(/^L-\d{6}$/); // passou pelo Contador (regra 6)
    expect(lead.vendedorDonoId).toBe(dono.id); // dono do número
    expect(lead.telefoneE164).toBe("+5511970001111");
    expect(lead.origemCampanha).toBe("Promo Julho");
    expect(lead.origemAnuncio).toBe("ad-123");

    const contato = await prisma.contatoWhatsApp.findFirstOrThrow();
    expect(contato.leadId).toBe(lead.id); // contato vinculado ao lead criado

    const tipos = (await eventosDo("Lead", lead.id)).map((e) => e.tipo);
    expect(tipos).toContain("LeadCriado");
    expect(tipos).toContain("LeadAtribuido");
  });

  it("telefone que JÁ é lead → vincula o contato, NÃO cria lead novo (dedupe)", async () => {
    const numero = await seedNumeroVendas();
    await ligarConfig({ autoLeadAtivo: true });
    const existente = await prisma.lead.create({
      data: { codigo: "L-000099", nome: "Lead Existente", telefoneE164: "+5511970001111", vendedorDonoId: dono.id },
    });

    await inbound(numero);

    expect(await prisma.lead.count()).toBe(1);
    const contato = await prisma.contatoWhatsApp.findFirstOrThrow();
    expect(contato.leadId).toBe(existente.id);
  });

  it("telefone que já é ALUNO → vincula ao aluno, sem lead", async () => {
    const numero = await seedNumeroVendas();
    await ligarConfig({ autoLeadAtivo: true });
    const { pais } = await seedCatalogoMinimo();
    const aluno = await prisma.aluno.create({
      data: { primeiroNome: "João", sobrenome: "Cliente", paisId: pais.id, telefoneE164: "+5511970001111" },
    });

    await inbound(numero);

    expect(await prisma.lead.count()).toBe(0);
    const contato = await prisma.contatoWhatsApp.findFirstOrThrow();
    expect(contato.alunoId).toBe(aluno.id);
  });

  it("config desligada → nenhum lead é criado", async () => {
    const numero = await seedNumeroVendas();
    await ligarConfig({ autoLeadAtivo: false });
    await inbound(numero);
    expect(await prisma.lead.count()).toBe(0);
  });

  it("número de COBRANÇA nunca auto-captura", async () => {
    await ligarConfig({ autoLeadAtivo: true });
    const numero = await prisma.numeroWhatsApp.create({
      data: { telefoneE164: "+5511900000000", rotulo: "Cobrança", driver: "META_CLOUD", finalidade: "COBRANCA", providerRef: "phone-cob" },
    });
    await inbound(numero);
    expect(await prisma.lead.count()).toBe(0);
  });
});

describe("saudação reativa (isenta de janela/trava S1 — gap C20)", () => {
  it("saudação ligada → intenção reativa enfileirada e SIMULADA (sem live), NÃO cancelada pela trava S1", async () => {
    const numero = await seedNumeroVendas(); // BAILEYS: uma automação CRON normal seria cancelada por S1
    await ligarConfig({ saudacaoAtiva: true, autoLeadAtivo: false });

    await inbound(numero);

    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.reativa).toBe(true);
    // SIMULADA (não CANCELADA/ADIADA) prova que a reativa passou pela trava S1 e pela janela.
    expect(intencao.status).toBe("SIMULADA");
  });

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

  it("auto-lead e saudação são independentes: só saudação ligada → saudação vai, sem lead", async () => {
    const numero = await seedNumeroVendas();
    await ligarConfig({ saudacaoAtiva: true, autoLeadAtivo: false });
    await inbound(numero);
    expect(await prisma.lead.count()).toBe(0);
    expect(await prisma.intencaoMensagem.count({ where: { reativa: true } })).toBe(1);
  });

  it("opt-out na 1ª mensagem → sem captura e sem saudação", async () => {
    const numero = await seedNumeroVendas();
    await ligarConfig({ saudacaoAtiva: true, autoLeadAtivo: true });
    await inbound(numero, { corpo: "sair" });
    expect(await prisma.lead.count()).toBe(0);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
    const contato = await prisma.contatoWhatsApp.findFirstOrThrow();
    expect(contato.optOutEm).not.toBeNull();
  });

  it("só o 1º inbound dispara — a 2ª mensagem não duplica lead nem saudação", async () => {
    const numero = await seedNumeroVendas();
    await ligarConfig({ saudacaoAtiva: true, autoLeadAtivo: true });
    await inbound(numero, { providerMessageId: "MSG-1", corpo: "oi" });
    await inbound(numero, { providerMessageId: "MSG-2", corpo: "ainda aí?" });
    expect(await prisma.lead.count()).toBe(1);
    expect(await prisma.intencaoMensagem.count({ where: { reativa: true } })).toBe(1);
  });
});
