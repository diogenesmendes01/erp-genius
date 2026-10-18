import { DriverWhatsApp } from "@prisma/client";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { EtapaLead } from "@prisma/client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import { CHAVE_PRE_EXPERIMENTAL } from "@/server/comercial/regua-fabrica";
import { processarMensagemNormalizada } from "./inbound";

// Integração E6/C2 (doc 27): captura da confirmação da experimental por keyword (fallback Baileys).

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

/** Lead com experimental marcada para daqui a `emMin` minutos (negativo = já passou). */
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

/**
 * Marca um degrau como CUMPRIDO do jeito que o despachante marca: evento
 * `ReguaComercialEnviada { chave, passo, ocorrencia }`. A OCORRÊNCIA é a âncora em ISO
 * (review PR #56) — é ela que amarra o passo ao CICLO, e não ao lead para sempre.
 */
async function marcarPassoFeito(leadId: string, chave: string, passo: string, ancoraEm: Date) {
  return prisma.evento.create({
    data: {
      tipo: "ReguaComercialEnviada",
      agregadoTipo: "Lead",
      agregadoId: leadId,
      payload: { chave, passo, ocorrencia: ancoraEm.toISOString(), canal: "api" },
      // `criadoEm` EXPLÍCITO no passado. A captura da resposta exige que a pergunta tenha sido
      // feita ANTES dela (`criadoEm <= quando`), e o default `now()` é o relógio do POSTGRES
      // enquanto o `quando` do inbound é o relógio do NODE — poucos ms de desvio entre os dois
      // deixariam o teste intermitente. Um minuto atrás também é o que acontece de verdade.
      criadoEm: new Date(Date.now() - 60_000),
    },
  });
}

/** Move a experimental do lead para um horário novo (o que `agendarExperimental` faz no banco). */
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

  /** O lembrete pré-experimental DESTA ocorrência de fato saiu (é a "pergunta" do diálogo). */
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
    expect(atualizado.experimentalConfirmadaEm).toBeNull(); // não confirma
    expect(atualizado.etapa).toBe(EtapaLead.EXPERIMENTAL_AGENDADA); // não mexe no funil
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

  // CORRELAÇÃO (review PR #56 P2): confirmar é RESPONDER a uma pergunta. A prova de que a
  // pergunta foi feita é o evento `ReguaComercialEnviada { PRE_EXPERIMENTAL, ocorrencia }`.
  // Sem isso, um "sim" solto (fim de qualquer conversa com o vendedor, ou o eco de um assunto
  // completamente diferente) marcaria presença — e presença falsa é pior que nenhuma: o
  // vendedor deixa de ligar para quem não vai aparecer.
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
    // O lembrete saiu para o horário ANTIGO; depois o vendedor remarcou (ocorrência nova).
    await lembretePreExperimentalEnviado(lead.id, lead.dataExperimental!);
    await reagendarPara(lead.id, 3 * 24 * 60);

    await inbound(numero, contato.telefoneE164.replace("+", ""), "sim");

    const atualizado = await prisma.oportunidade.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atualizado.experimentalConfirmadaEm).toBeNull();
    expect((await eventosDo("Lead", lead.id)).map((e) => e.tipo)).not.toContain("ExperimentalConfirmada");
  });
});
