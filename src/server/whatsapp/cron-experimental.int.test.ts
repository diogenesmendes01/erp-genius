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
        // B1 (doc 32): estas suites cobrem o comportamento GERAL — go-live explícito.
        modoPiloto: false,
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
  await prisma.lead.update({
    where: { id: leadId },
    data: { dataExperimental, etapa, experimentalConfirmadaEm: null },
  });
  return dataExperimental;
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
    await marcarPassoFeito(lead.id, CHAVE_NO_SHOW, "+30min", lead.dataExperimental!);

    const r = await rodarNoShow();
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.passoComercial).toBe("+1d");
    expect(r.enfileiradas).toBe(1);
  });
});

// A cadência pertence à OCORRÊNCIA, não ao lead (review PR #56). O histórico do lead é
// eterno; o ciclo, não. Sem o recorte por ocorrência, o `-24h` de uma experimental que o
// lead furou marcaria o `-24h` da experimental REMARCADA como já cumprido — e o lembrete
// mais importante da régua (o que ataca o no-show) nunca sairia na segunda tentativa.
describe("ocorrência: cada ciclo nasce com a cadência limpa", () => {
  it("experimental REAGENDADA: o -24h do ciclo anterior não cumpre o do novo horário", async () => {
    const numero = await seedNumero();
    await seedPolitica(CHAVE_PRE_EXPERIMENTAL, "Pré", CADENCIA_PRE_EXPERIMENTAL, numero.id);
    // Ciclo 1: experimental para daqui a 3h, com o -24h JÁ enviado.
    const { lead } = await seedLeadExperimental(numero.id, 180, EtapaLead.EXPERIMENTAL_AGENDADA);
    await marcarPassoFeito(lead.id, CHAVE_PRE_EXPERIMENTAL, "-24h", lead.dataExperimental!);

    // Contra-prova: no MESMO ciclo o -24h está cumprido e o -2h ainda não chegou (faltam 3h).
    expect((await rodarPreExperimental()).enfileiradas).toBe(0);

    // Ciclo 2: o vendedor remarca para daqui a 20h — JÁ dentro da janela do -24h (e ainda
    // longe do -2h), então o 1º degrau do ciclo novo está vencido neste mesmo tick.
    await reagendarPara(lead.id, 20 * 60);

    const r = await rodarPreExperimental();
    expect(r.enfileiradas).toBe(1); // antes da #56 isto era 0: o -24h "já feito" matava o ciclo novo
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.passoComercial).toBe("-24h");
    // A intenção carrega a identidade do ciclo NOVO (é ela que garante a unicidade por ciclo).
    const atualizado = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(intencao.ocorrenciaComercial).toBe(atualizado.dataExperimental!.toISOString());
  });

  it("SEGUNDO no-show do mesmo lead: o +30min da falta anterior não cumpre o da nova", async () => {
    const numero = await seedNumero();
    await seedPolitica(CHAVE_NO_SHOW, "No-show", CADENCIA_NO_SHOW, numero.id);
    // Falta 1: aula perdida há 25h, com +30min e +1d já enviados → o +3d só chega em 3 dias.
    const { lead } = await seedLeadExperimental(numero.id, -1500, EtapaLead.NO_SHOW);
    await marcarPassoFeito(lead.id, CHAVE_NO_SHOW, "+30min", lead.dataExperimental!);
    await marcarPassoFeito(lead.id, CHAVE_NO_SHOW, "+1d", lead.dataExperimental!);
    expect((await rodarNoShow()).enfileiradas).toBe(0);

    // Falta 2: o lead remarcou, veio outra aula há 45min e ele furou de novo (o check-in do
    // professor devolveu o lead para NO_SHOW). A recuperação recomeça do primeiro degrau.
    await reagendarPara(lead.id, -45, EtapaLead.NO_SHOW);

    const r = await rodarNoShow();
    expect(r.enfileiradas).toBe(1);
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.passoComercial).toBe("+30min");
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

  /** O lembrete pré-experimental DESTA ocorrência de fato saiu (é a "pergunta" do diálogo). */
  async function lembretePreExperimentalEnviado(leadId: string, ancoraEm: Date) {
    return marcarPassoFeito(leadId, CHAVE_PRE_EXPERIMENTAL, "-24h", ancoraEm);
  }

  it('"SIM" confirma a presença e grava o evento', async () => {
    const numero = await seedNumero();
    const { lead, contato } = await seedLeadExperimental(numero.id, 120, EtapaLead.EXPERIMENTAL_AGENDADA);
    await lembretePreExperimentalEnviado(lead.id, lead.dataExperimental!);

    await inbound(numero, contato.telefoneE164.replace("+", ""), "SIM");

    const atualizado = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atualizado.experimentalConfirmadaEm).not.toBeNull();
    expect((await eventosDo("Lead", lead.id)).map((e) => e.tipo)).toContain("ExperimentalConfirmada");
  });

  it('"REAGENDAR" só sinaliza (evento) — quem remarca é o vendedor', async () => {
    const numero = await seedNumero();
    const { lead, contato } = await seedLeadExperimental(numero.id, 120, EtapaLead.EXPERIMENTAL_AGENDADA);
    await lembretePreExperimentalEnviado(lead.id, lead.dataExperimental!);

    await inbound(numero, contato.telefoneE164.replace("+", ""), "reagendar");

    const atualizado = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atualizado.experimentalConfirmadaEm).toBeNull(); // não confirma
    expect(atualizado.etapa).toBe(EtapaLead.EXPERIMENTAL_AGENDADA); // não mexe no funil
    expect((await eventosDo("Lead", lead.id)).map((e) => e.tipo)).toContain("ExperimentalReagendamentoSolicitado");
  });

  it("frase que contém 'sim' NÃO confirma (match exato e conservador)", async () => {
    const numero = await seedNumero();
    const { lead, contato } = await seedLeadExperimental(numero.id, 120, EtapaLead.EXPERIMENTAL_AGENDADA);
    await lembretePreExperimentalEnviado(lead.id, lead.dataExperimental!);

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

  // CORRELAÇÃO (review PR #56 P2): confirmar é RESPONDER a uma pergunta. A prova de que a
  // pergunta foi feita é o evento `ReguaComercialEnviada { PRE_EXPERIMENTAL, ocorrencia }`.
  // Sem isso, um "sim" solto (fim de qualquer conversa com o vendedor, ou o eco de um assunto
  // completamente diferente) marcaria presença — e presença falsa é pior que nenhuma: o
  // vendedor deixa de ligar para quem não vai aparecer.
  it("(a) sem lembrete pré-experimental enviado, 'sim' NÃO confirma", async () => {
    const numero = await seedNumero();
    const { lead, contato } = await seedLeadExperimental(numero.id, 120, EtapaLead.EXPERIMENTAL_AGENDADA);

    await inbound(numero, contato.telefoneE164.replace("+", ""), "sim");

    const atualizado = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atualizado.experimentalConfirmadaEm).toBeNull();
    expect((await eventosDo("Lead", lead.id)).map((e) => e.tipo)).not.toContain("ExperimentalConfirmada");
  });

  it("(b) com o lembrete DESTA ocorrência, 'sim' confirma", async () => {
    const numero = await seedNumero();
    const { lead, contato } = await seedLeadExperimental(numero.id, 120, EtapaLead.EXPERIMENTAL_AGENDADA);
    await lembretePreExperimentalEnviado(lead.id, lead.dataExperimental!);

    await inbound(numero, contato.telefoneE164.replace("+", ""), "sim");

    const atualizado = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
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

    const atualizado = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atualizado.experimentalConfirmadaEm).toBeNull();
    expect((await eventosDo("Lead", lead.id)).map((e) => e.tipo)).not.toContain("ExperimentalConfirmada");
  });
});
