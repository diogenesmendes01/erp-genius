import { describe, it, expect, beforeEach, vi } from "vitest";
import { EtapaLead, type EstadoPolitica } from "@prisma/client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import {
  CADENCIA_NO_SHOW,
  CADENCIA_PRE_EXPERIMENTAL,
  CHAVE_NO_SHOW,
  CHAVE_PRE_EXPERIMENTAL,
} from "@/server/comercial/regua-fabrica";
import { processarMensagemNormalizada } from "./inbound";
import { rodarNoShow, rodarPreExperimental } from "./cron-comercial";

// Integração E6/C2 (doc 27): pré-experimental (24h/2h ANTES — offsets negativos) e
// recuperação de no-show, + captura da confirmação por keyword (fallback Baileys).

let dono: Awaited<ReturnType<typeof criarUsuario>>;

beforeEach(async () => {
  await truncarBanco();
  dono = await criarUsuario([]);
});

async function seedNumero() {
  return prisma.numeroWhatsApp.create({
    data: { telefoneE164: "+5511988887777", rotulo: "Vendas", driver: "BAILEYS", finalidade: "VENDAS", providerRef: "inst-c2", donoId: dono.id },
  });
}

async function seedPolitica(
  chave: string,
  nome: string,
  degraus: readonly { passo: string; offsetMinutos: number; rotulo: string }[],
  numeroId: string,
  estado: EstadoPolitica = "SHADOW",
) {
  return prisma.politicaComercial.create({
    data: {
      chave,
      nome,
      estado,
      janelaInicio: 0,
      janelaFim: 24,
      diasSemana: [0, 1, 2, 3, 4, 5, 6],
      numeroRemetenteId: numeroId,
      degraus: { create: degraus.map((d) => ({ passo: d.passo, offsetMinutos: d.offsetMinutos, rotulo: d.rotulo, ativo: true })) },
    },
  });
}

/** Lead com experimental marcada para daqui a `emMin` minutos (negativo = já passou). */
async function seedLeadExperimental(numeroId: string, emMin: number, etapa: EtapaLead) {
  const lead = await prisma.lead.create({
    data: {
      codigo: `L-${Math.floor(Math.random() * 1e6)}`,
      nome: "Ana",
      etapa,
      dataExperimental: new Date(Date.now() + emMin * 60_000),
      vendedorDonoId: dono.id,
    },
  });
  const contato = await prisma.contatoWhatsApp.create({
    data: { telefoneE164: `+5069${Math.floor(Math.random() * 1e7)}`, leadId: lead.id },
  });
  const conversa = await prisma.conversaWhatsApp.create({
    data: { numeroId, contatoId: contato.id, capturadaEm: new Date(), ultimaMensagemEm: new Date() },
  });
  return { lead, contato, conversa };
}

describe("pré-experimental (24h/2h ANTES — offsets negativos)", () => {
  it("faltando 3h → dispara o degrau de 24h antes (o de 2h ainda não chegou)", async () => {
    const numero = await seedNumero();
    await seedPolitica(CHAVE_PRE_EXPERIMENTAL, "Pré", CADENCIA_PRE_EXPERIMENTAL, numero.id);
    await seedLeadExperimental(numero.id, 180, EtapaLead.EXPERIMENTAL_AGENDADA);

    const r = await rodarPreExperimental();
    expect(r.enfileiradas).toBe(1);
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.passoComercial).toBe("-24h");
  });

  it("faltando 1h → dispara o degrau de 2h antes (o mais avançado que chegou)", async () => {
    const numero = await seedNumero();
    await seedPolitica(CHAVE_PRE_EXPERIMENTAL, "Pré", CADENCIA_PRE_EXPERIMENTAL, numero.id);
    await seedLeadExperimental(numero.id, 60, EtapaLead.EXPERIMENTAL_AGENDADA);

    const r = await rodarPreExperimental();
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.passoComercial).toBe("-2h");
    expect(r.enfileiradas).toBe(1);
  });

  it("faltando 30h → nada devido ainda (antes do 1º degrau)", async () => {
    const numero = await seedNumero();
    await seedPolitica(CHAVE_PRE_EXPERIMENTAL, "Pré", CADENCIA_PRE_EXPERIMENTAL, numero.id);
    await seedLeadExperimental(numero.id, 1800, EtapaLead.EXPERIMENTAL_AGENDADA);

    const r = await rodarPreExperimental();
    expect(r.enfileiradas).toBe(0);
  });

  it("a aula JÁ COMEÇOU → encerrada: lembrete atrasado nunca é enviado", async () => {
    const numero = await seedNumero();
    await seedPolitica(CHAVE_PRE_EXPERIMENTAL, "Pré", CADENCIA_PRE_EXPERIMENTAL, numero.id);
    await seedLeadExperimental(numero.id, -30, EtapaLead.EXPERIMENTAL_AGENDADA); // começou há 30min

    const r = await rodarPreExperimental();
    expect(r.encerrados).toBe(1);
    expect(r.enfileiradas).toBe(0);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("lead fora de EXPERIMENTAL_AGENDADA não entra na varredura", async () => {
    const numero = await seedNumero();
    await seedPolitica(CHAVE_PRE_EXPERIMENTAL, "Pré", CADENCIA_PRE_EXPERIMENTAL, numero.id);
    await seedLeadExperimental(numero.id, 60, EtapaLead.QUALIFICADO);

    const r = await rodarPreExperimental();
    expect(r.leadsAvaliados).toBe(0);
  });
});

describe("recuperação de no-show", () => {
  it("aula perdida há 45min + etapa NO_SHOW → dispara o +30min", async () => {
    const numero = await seedNumero();
    await seedPolitica(CHAVE_NO_SHOW, "No-show", CADENCIA_NO_SHOW, numero.id);
    await seedLeadExperimental(numero.id, -45, EtapaLead.NO_SHOW);

    const r = await rodarNoShow();
    expect(r.enfileiradas).toBe(1);
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.passoComercial).toBe("+30min");
  });

  it("lead que remarcou (voltou p/ EXPERIMENTAL_AGENDADA) sai da recuperação", async () => {
    const numero = await seedNumero();
    await seedPolitica(CHAVE_NO_SHOW, "No-show", CADENCIA_NO_SHOW, numero.id);
    await seedLeadExperimental(numero.id, -45, EtapaLead.EXPERIMENTAL_AGENDADA);

    const r = await rodarNoShow();
    expect(r.leadsAvaliados).toBe(0);
    expect(r.enfileiradas).toBe(0);
  });

  it("forward-only: +30min cumprido, 1 dia depois o devido é o +1d", async () => {
    const numero = await seedNumero();
    await seedPolitica(CHAVE_NO_SHOW, "No-show", CADENCIA_NO_SHOW, numero.id);
    const { lead } = await seedLeadExperimental(numero.id, -1500, EtapaLead.NO_SHOW); // 25h atrás
    await prisma.evento.create({
      data: { tipo: "ReguaComercialEnviada", agregadoTipo: "Lead", agregadoId: lead.id, payload: { chave: CHAVE_NO_SHOW, passo: "+30min", canal: "api" } },
    });

    const r = await rodarNoShow();
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.passoComercial).toBe("+1d");
    expect(r.enfileiradas).toBe(1);
  });
});

describe("confirmação da experimental por keyword (fallback Baileys — doc 27)", () => {
  async function inbound(numero: { providerRef: string | null }, waId: string, corpo: string) {
    return processarMensagemNormalizada({
      numeroProviderRef: numero.providerRef,
      contatoWaId: waId,
      providerMessageId: `MSG-${Math.random().toString(36).slice(2)}`,
      corpo,
      tipo: "TEXTO",
      driver: "BAILEYS",
      fromMe: false,
      quando: new Date(),
    });
  }

  it('"SIM" confirma a presença e grava o evento', async () => {
    const numero = await seedNumero();
    const { lead, contato } = await seedLeadExperimental(numero.id, 120, EtapaLead.EXPERIMENTAL_AGENDADA);

    await inbound(numero, contato.telefoneE164.replace("+", ""), "SIM");

    const atualizado = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atualizado.experimentalConfirmadaEm).not.toBeNull();
    expect((await eventosDo("Lead", lead.id)).map((e) => e.tipo)).toContain("ExperimentalConfirmada");
  });

  it('"REAGENDAR" só sinaliza (evento) — quem remarca é o vendedor', async () => {
    const numero = await seedNumero();
    const { lead, contato } = await seedLeadExperimental(numero.id, 120, EtapaLead.EXPERIMENTAL_AGENDADA);

    await inbound(numero, contato.telefoneE164.replace("+", ""), "reagendar");

    const atualizado = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atualizado.experimentalConfirmadaEm).toBeNull(); // não confirma
    expect(atualizado.etapa).toBe(EtapaLead.EXPERIMENTAL_AGENDADA); // não mexe no funil
    expect((await eventosDo("Lead", lead.id)).map((e) => e.tipo)).toContain("ExperimentalReagendamentoSolicitado");
  });

  it("frase que contém 'sim' NÃO confirma (match exato e conservador)", async () => {
    const numero = await seedNumero();
    const { lead, contato } = await seedLeadExperimental(numero.id, 120, EtapaLead.EXPERIMENTAL_AGENDADA);

    await inbound(numero, contato.telefoneE164.replace("+", ""), "sim, mas preciso ver o horário");

    const atualizado = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atualizado.experimentalConfirmadaEm).toBeNull();
  });

  it("lead sem experimental agendada: 'SIM' não confirma nada", async () => {
    const numero = await seedNumero();
    const { lead, contato } = await seedLeadExperimental(numero.id, 120, EtapaLead.QUALIFICADO);

    await inbound(numero, contato.telefoneE164.replace("+", ""), "sim");

    const atualizado = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atualizado.experimentalConfirmadaEm).toBeNull();
    expect((await eventosDo("Lead", lead.id)).map((e) => e.tipo)).not.toContain("ExperimentalConfirmada");
  });
});
