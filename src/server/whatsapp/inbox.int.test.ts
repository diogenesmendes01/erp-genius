import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { listarConversas, carregarThread } from "./consultas";
import { despacharFila } from "./despachante";
import { processarMensagemNormalizada } from "./inbound";
import {
  enviarTextoInbox,
  marcarConversaTratada,
  registrarOptOutContato,
  vincularContatoWhatsApp,
} from "./acoes";

// Integração E3 (doc 30): inbox — escopo por número (D22/S11), envio HUMANO pela mesma
// fila/despachante, opt-out (S10), silêncio pós-inbound tratado (S4) e vínculo de contato.

let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let financeiro: Awaited<ReturnType<typeof criarUsuario>>;

beforeEach(async () => {
  await truncarBanco();
  vendedor = await criarUsuario([Papel.VENDEDOR]);
  financeiro = await criarUsuario([Papel.FINANCEIRO]);
});

async function seedConversaVendas(donoId: string | null) {
  const numero = await prisma.numeroWhatsApp.create({
    data: {
      telefoneE164: "+5511988880000",
      rotulo: "Vendas (teste)",
      driver: "BAILEYS",
      finalidade: "VENDAS",
      providerRef: "inst-teste",
      donoId,
    },
  });
  const contato = await prisma.contatoWhatsApp.create({
    data: { telefoneE164: "+50611112222", nomeExibicao: "Cliente" },
  });
  const conversa = await prisma.conversaWhatsApp.create({
    data: { numeroId: numero.id, contatoId: contato.id, ultimaMensagemEm: new Date() },
  });
  return { numero, contato, conversa };
}

describe("escopo da conversa (D22/S11)", () => {
  it("vendedor vê só conversas do número que possui; financeiro só as de cobrança", async () => {
    const minha = await seedConversaVendas(vendedor.id);
    const outroVendedor = await criarUsuario([Papel.VENDEDOR]);

    const doDono = await listarConversas({ id: vendedor.id, nome: "v", papeis: [Papel.VENDEDOR] });
    expect(doDono.map((c) => c.id)).toEqual([minha.conversa.id]);

    const doOutro = await listarConversas({ id: outroVendedor.id, nome: "o", papeis: [Papel.VENDEDOR] });
    expect(doOutro).toHaveLength(0);

    const doFinanceiro = await listarConversas({ id: financeiro.id, nome: "f", papeis: [Papel.FINANCEIRO] });
    expect(doFinanceiro).toHaveLength(0); // número é de VENDAS

    const thread = await carregarThread({ id: outroVendedor.id, nome: "o", papeis: [Papel.VENDEDOR] }, minha.conversa.id);
    expect(thread).toBeNull();
  });
});

describe("enviarTextoInbox (origem HUMANO na MESMA fila)", () => {
  it("grava intenção HUMANO e despacha — sem WHATSAPP_LIVE vira SIMULADA", async () => {
    const { conversa } = await seedConversaVendas(vendedor.id);
    authMock.mockResolvedValue({ user: { id: vendedor.id } });

    const r = await enviarTextoInbox({ conversaId: conversa.id, texto: "Olá! Podemos falar?" });
    expect(r.ok, r.ok ? "" : `falhou: ${(r as { erro?: string }).erro}`).toBe(true);
    expect(r.ok && r.dado!.status).toBe("SIMULADA");

    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.origem).toBe("HUMANO");
    expect(intencao.autorId).toBe(vendedor.id);
    expect(intencao.cobrancaId).toBeNull();
  });

  it("fora do escopo → negado; opt-out → bloqueado com mensagem clara", async () => {
    const { conversa, contato } = await seedConversaVendas(vendedor.id);
    const intruso = await criarUsuario([Papel.VENDEDOR]);
    authMock.mockResolvedValue({ user: { id: intruso.id } });
    const negado = await enviarTextoInbox({ conversaId: conversa.id, texto: "oi" });
    expect(negado.ok).toBe(false);

    await prisma.contatoWhatsApp.update({ where: { id: contato.id }, data: { optOutEm: new Date() } });
    authMock.mockResolvedValue({ user: { id: vendedor.id } });
    const bloqueado = await enviarTextoInbox({ conversaId: conversa.id, texto: "oi" });
    expect(bloqueado.ok).toBe(false);
    expect((bloqueado as { erro?: string }).erro).toContain("opt-out");
  });

  it("kill switch congela a AUTOMAÇÃO mas não a resposta humana (S13)", async () => {
    await seedCanal({ estado: "ATIVA", janela: [0, 24] }); // política de cobrança (padrão p/ intenções sem política)
    await prisma.politicaRegua.updateMany({ data: { killSwitch: true } });
    const { conversa, numero, contato } = await seedConversaVendas(vendedor.id);
    authMock.mockResolvedValue({ user: { id: vendedor.id } });

    // HUMANO passa (vira SIMULADA no ambiente sem live)…
    const r = await enviarTextoInbox({ conversaId: conversa.id, texto: "resposta humana" });
    expect(r.ok && r.dado!.status).toBe("SIMULADA");

    // …automação fica congelada na fila.
    await prisma.intencaoMensagem.create({
      data: { numeroId: numero.id, contatoId: contato.id, origem: "LOTE", corpoRenderizado: "auto" },
    });
    const despacho = await despacharFila();
    expect(despacho.pendentes).toBe(1);
  });
});

describe("opt-out (S10)", () => {
  it("keyword exata no inbound marca o contato e grava o evento", async () => {
    const { numero } = await seedConversaVendas(vendedor.id);
    const r = await processarMensagemNormalizada({
      numeroProviderRef: numero.providerRef,
      contatoWaId: "50633334444",
      providerMessageId: "MSG-OPTOUT-1",
      corpo: "SAIR",
      tipo: "TEXTO",
      driver: "BAILEYS",
      fromMe: false,
      quando: new Date(),
    });
    expect(r).toBe("gravada");

    const contato = await prisma.contatoWhatsApp.findUniqueOrThrow({ where: { telefoneE164: "+50633334444" } });
    expect(contato.optOutEm).not.toBeNull();
    const eventos = await eventosDo("ContatoWhatsApp", contato.id);
    expect(eventos.map((e) => e.tipo)).toContain("OptOutRegistrado");
  });

  it("frase que só contém a palavra não marca", async () => {
    const { numero } = await seedConversaVendas(vendedor.id);
    await processarMensagemNormalizada({
      numeroProviderRef: numero.providerRef,
      contatoWaId: "50633334444",
      providerMessageId: "MSG-OPTOUT-2",
      corpo: "vou parar de atrasar, prometo",
      tipo: "TEXTO",
      driver: "BAILEYS",
      fromMe: false,
      quando: new Date(),
    });
    const contato = await prisma.contatoWhatsApp.findUniqueOrThrow({ where: { telefoneE164: "+50633334444" } });
    expect(contato.optOutEm).toBeNull();
  });

  it("botão da thread registra e o duplo clique não duplica", async () => {
    const { contato } = await seedConversaVendas(vendedor.id);
    authMock.mockResolvedValue({ user: { id: vendedor.id } });

    const r1 = await registrarOptOutContato(contato.id);
    expect(r1.ok).toBe(true);
    const r2 = await registrarOptOutContato(contato.id);
    expect(r2.ok).toBe(false); // já em opt-out

    expect((await eventosDo("ContatoWhatsApp", contato.id)).filter((e) => e.tipo === "OptOutRegistrado")).toHaveLength(1);
  });
});

describe("silêncio pós-inbound tratado (S4/E3)", () => {
  it("inbound não tratado ADIA o cron; tratar libera", async () => {
    const { numero } = await seedCanal({ estado: "SHADOW", janela: [0, 24] });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50655556666" } });
    const umaHoraAtras = new Date(Date.now() - 3600_000);
    const conversa = await prisma.conversaWhatsApp.create({
      data: { numeroId: numero.id, contatoId: contato.id, ultimoInboundEm: umaHoraAtras },
    });

    // Intenção do CRON criada DEPOIS do inbound (a lei da conversa viva não pega; S4 sim).
    await prisma.intencaoMensagem.create({
      data: { numeroId: numero.id, contatoId: contato.id, origem: "CRON", corpoRenderizado: "degrau" },
    });
    const antes = await despacharFila();
    expect(antes.adiadas).toBe(1);
    const adiada = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(adiada.motivoFalha).toBe("silencio_pos_inbound");

    // "Tratar" (retomar régua) marca inboundTratadoEm → o silêncio deixa de valer.
    authMock.mockResolvedValue({ user: { id: financeiro.id } });
    const tratado = await marcarConversaTratada({ conversaId: conversa.id, motivo: "retomar_regua" });
    expect(tratado.ok, tratado.ok ? "" : `falhou: ${(tratado as { erro?: string }).erro}`).toBe(true);
    expect((await eventosDo("ContatoWhatsApp", contato.id)).map((e) => e.tipo)).toContain("ReguaRetomada");

    // Reabre a intenção adiada para redespachar agora (sem esperar as 72h).
    await prisma.intencaoMensagem.update({
      where: { id: adiada.id },
      data: { status: "PENDENTE", despacharAposEm: null },
    });
    const depois = await despacharFila();
    expect(depois.simuladas).toBe(1); // passou do S4; morre no shadow (sem WHATSAPP_LIVE)
  });

  it("vendedor não pode retomar régua (alçada de cobrança)", async () => {
    const { conversa } = await seedConversaVendas(vendedor.id);
    authMock.mockResolvedValue({ user: { id: vendedor.id } });
    const r = await marcarConversaTratada({ conversaId: conversa.id, motivo: "retomar_regua" });
    expect(r.ok).toBe(false);
  });
});

describe("vincularContatoWhatsApp", () => {
  it("vendedor vincula ao PRÓPRIO lead; lead alheio é negado; evento auditável", async () => {
    const { contato } = await seedConversaVendas(vendedor.id);
    const outro = await criarUsuario([Papel.VENDEDOR]);
    const meuLead = await prisma.lead.create({ data: { nome: "Lead Meu", vendedorDonoId: vendedor.id } });
    const leadAlheio = await prisma.lead.create({ data: { nome: "Lead Alheio", vendedorDonoId: outro.id } });
    authMock.mockResolvedValue({ user: { id: vendedor.id } });

    const negado = await vincularContatoWhatsApp({ contatoId: contato.id, alvo: { tipo: "lead", id: leadAlheio.id } });
    expect(negado.ok).toBe(false);

    const ok = await vincularContatoWhatsApp({ contatoId: contato.id, alvo: { tipo: "lead", id: meuLead.id } });
    expect(ok.ok, ok.ok ? "" : `falhou: ${(ok as { erro?: string }).erro}`).toBe(true);

    const atualizado = await prisma.contatoWhatsApp.findUniqueOrThrow({ where: { id: contato.id } });
    expect(atualizado.leadId).toBe(meuLead.id);
    expect((await eventosDo("ContatoWhatsApp", contato.id)).map((e) => e.tipo)).toContain("ContatoVinculado");
  });
});
