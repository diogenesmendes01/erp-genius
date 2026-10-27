import { DriverWhatsApp } from "@prisma/client";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { EtapaLead } from "@prisma/client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import { processarMensagemNormalizada } from "./inbound";

const CHAVE_PRE_EXPERIMENTAL = "PRE_EXPERIMENTAL";

let dono: Awaited<ReturnType<typeof criarUsuario>>;

beforeEach(async () => {
  await truncarBanco();
  dono = await criarUsuario([]);
});

async function seedNumero() {
  return prisma.numeroWhatsApp.create({
    data: { telefoneE164: "+5511988887777", rotulo: "Vendas", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS", providerRef: "inst-c2", donoId: dono.id },
  });
}

async function seedLeadExperimental(numeroId: string, emMin: number, etapa: EtapaLead) {
  const lead = await prisma.oportunidade.create({
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

async function marcarPassoFeito(leadId: string, chave: string, passo: string, ancoraEm: Date) {
  return prisma.evento.create({
    data: {
      tipo: "ReguaComercialEnviada",
      agregadoTipo: "Lead",
      agregadoId: leadId,
      payload: { chave, passo, ocorrencia: ancoraEm.toISOString(), canal: "api" },
      criadoEm: new Date(Date.now() - 60_000),
    },
  });
}

async function reagendarPara(leadId: string, emMin: number, etapa: EtapaLead = EtapaLead.EXPERIMENTAL_AGENDADA) {
  const dataExperimental = new Date(Date.now() + emMin * 60_000);
  await prisma.oportunidade.update({
    where: { id: leadId },
    data: { dataExperimental, etapa, experimentalConfirmadaEm: null },
  });
  return dataExperimental;
}

describe("confirmação da experimental por keyword (fallback Baileys — doc 27)", () => {
  async function inbound(numero: { providerRef: string | null }, waId: string, corpo: string) {
    return processarMensagemNormalizada({
      numeroProviderRef: numero.providerRef,
      contatoWaId: waId,
      providerMessageId: `MSG-${Math.random().toString(36).slice(2)}`,
      corpo,
      tipo: "TEXTO",
      driver: DriverWhatsApp.BAILEYS,
      fromMe: false,
      quando: new Date(),
    });
  }

  async function lembretePreExperimentalEnviado(leadId: string, ancoraEm: Date) {
    return marcarPassoFeito(leadId, CHAVE_PRE_EXPERIMENTAL, "-24h", ancoraEm);
  }

  it('"SIM" confirma a presença e grava o evento', async () => {
    const numero = await seedNumero();
    const { lead, contato } = await seedLeadExperimental(numero.id, 120, EtapaLead.EXPERIMENTAL_AGENDADA);
    await lembretePreExperimentalEnviado(lead.id, lead.dataExperimental!);

    await inbound(numero, contato.telefoneE164.replace("+", ""), "SIM");

    const atualizado = await prisma.oportunidade.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atualizado.experimentalConfirmadaEm).not.toBeNull();
    expect((await eventosDo("Lead", lead.id)).map((e) => e.tipo)).toContain("ExperimentalConfirmada");
  });

  it('"REAGENDAR" só sinaliza (evento) — quem remarca é o vendedor', async () => {
    const numero = await seedNumero();
    const { lead, contato } = await seedLeadExperimental(numero.id, 120, EtapaLead.EXPERIMENTAL_AGENDADA);
    await lembretePreExperimentalEnviado(lead.id, lead.dataExperimental!);

    await inbound(numero, contato.telefoneE164.replace("+", ""), "reagendar");

    const atualizado = await prisma.oportunidade.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atualizado.experimentalConfirmadaEm).toBeNull();
    expect(atualizado.etapa).toBe(EtapaLead.EXPERIMENTAL_AGENDADA);
    expect((await eventosDo("Lead", lead.id)).map((e) => e.tipo)).toContain("ExperimentalReagendamentoSolicitado");
  });

  it("frase que contém 'sim' NÃO confirma (match exato e conservador)", async () => {
    const numero = await seedNumero();
    const { lead, contato } = await seedLeadExperimental(numero.id, 120, EtapaLead.EXPERIMENTAL_AGENDADA);
    await lembretePreExperimentalEnviado(lead.id, lead.dataExperimental!);

    await inbound(numero, contato.telefoneE164.replace("+", ""), "sim, mas preciso ver o horário");

    const atualizado = await prisma.oportunidade.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atualizado.experimentalConfirmadaEm).toBeNull();
  });

  it("lead sem experimental agendada: 'SIM' não confirma nada", async () => {
    const numero = await seedNumero();
    const { lead, contato } = await seedLeadExperimental(numero.id, 120, EtapaLead.QUALIFICADO);

    await inbound(numero, contato.telefoneE164.replace("+", ""), "sim");

    const atualizado = await prisma.oportunidade.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atualizado.experimentalConfirmadaEm).toBeNull();
    expect((await eventosDo("Lead", lead.id)).map((e) => e.tipo)).not.toContain("ExperimentalConfirmada");
  });

  it("(a) sem lembrete pré-experimental enviado, 'sim' NÃO confirma", async () => {
    const numero = await seedNumero();
    const { lead, contato } = await seedLeadExperimental(numero.id, 120, EtapaLead.EXPERIMENTAL_AGENDADA);

    await inbound(numero, contato.telefoneE164.replace("+", ""), "sim");

    const atualizado = await prisma.oportunidade.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atualizado.experimentalConfirmadaEm).toBeNull();
    expect((await eventosDo("Lead", lead.id)).map((e) => e.tipo)).not.toContain("ExperimentalConfirmada");
  });

  it("(b) com o lembrete DESTA ocorrência, 'sim' confirma", async () => {
    const numero = await seedNumero();
    const { lead, contato } = await seedLeadExperimental(numero.id, 120, EtapaLead.EXPERIMENTAL_AGENDADA);
    await lembretePreExperimentalEnviado(lead.id, lead.dataExperimental!);

    await inbound(numero, contato.telefoneE164.replace("+", ""), "sim");

    const atualizado = await prisma.oportunidade.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atualizado.experimentalConfirmadaEm).not.toBeNull();
    expect((await eventosDo("Lead", lead.id)).map((e) => e.tipo)).toContain("ExperimentalConfirmada");
  });

  it("(c) lembrete da ocorrência ANTERIOR não vale para a experimental remarcada", async () => {
    const numero = await seedNumero();
    const { lead, contato } = await seedLeadExperimental(numero.id, 120, EtapaLead.EXPERIMENTAL_AGENDADA);
    await lembretePreExperimentalEnviado(lead.id, lead.dataExperimental!);
    await reagendarPara(lead.id, 3 * 24 * 60);

    await inbound(numero, contato.telefoneE164.replace("+", ""), "sim");

    const atualizado = await prisma.oportunidade.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atualizado.experimentalConfirmadaEm).toBeNull();
    expect((await eventosDo("Lead", lead.id)).map((e) => e.tipo)).not.toContain("ExperimentalConfirmada");
  });
});
