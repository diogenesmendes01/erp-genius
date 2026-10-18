import { DriverWhatsApp } from "@prisma/client";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { EtapaLead, type EstadoPolitica } from "@prisma/client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario } from "@/test/integracao";
import {
  CADENCIA_LEAD_NOVO,
  CADENCIA_PRE_EXPERIMENTAL,
  CHAVE_LEAD_NOVO,
  CHAVE_PRE_EXPERIMENTAL,
} from "@/server/comercial/regua-fabrica";
import { despacharFila } from "./despachante";

// BLOQUEADORES DO PILOTO (doc 32 §0) — B3 validade e B7 revalidação no despacho.

let dono: Awaited<ReturnType<typeof criarUsuario>>;

beforeEach(async () => {
  await truncarBanco();
  dono = await criarUsuario([]);
});

async function seedNumero() {
  return prisma.numeroWhatsApp.create({
    data: { telefoneE164: "+5511900001111", rotulo: "Vendas", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS", providerRef: "inst-piloto", donoId: dono.id },
  });
}

async function seedPolitica(
  chave: string,
  degraus: readonly { passo: string; offsetMinutos: number; rotulo: string; toleranciaMinutos: number | null }[],
  numeroId: string,
  over: { estado?: EstadoPolitica; modoPiloto?: boolean; pilotoLeadIds?: string[] } = {},
) {
  return prisma.politicaComercial.create({
    data: {
      chave,
      nome: chave,
      estado: over.estado ?? "SHADOW",
      modoPiloto: over.modoPiloto ?? false,
      pilotoLeadIds: over.pilotoLeadIds ?? [],
      janelaInicio: 0,
      janelaFim: 24,
      diasSemana: [0, 1, 2, 3, 4, 5, 6],
      numeroRemetenteId: numeroId,
      degraus: {
        create: degraus.map((d) => ({
          passo: d.passo,
          offsetMinutos: d.offsetMinutos,
          rotulo: d.rotulo,
          ativo: true,
          toleranciaMinutos: d.toleranciaMinutos,
        })),
      },
    },
  });
}

/** Lead frio: 1º inbound há `haMin` minutos (âncora da cadência C1). */
async function seedLeadFrio(numeroId: string, haMin: number, sufixo = "") {
  const capturadaEm = new Date(Date.now() - haMin * 60_000);
  const lead = await prisma.oportunidade.create({
    data: { codigo: `L-${Math.floor(Math.random() * 1e6)}`, nome: `Ana${sufixo}`, etapa: EtapaLead.NOVO, vendedorDonoId: dono.id },
  });
  const contato = await prisma.contatoWhatsApp.create({
    data: { telefoneE164: `+5069${Math.floor(Math.random() * 1e7)}`, leadId: lead.id },
  });
  const conversa = await prisma.conversaWhatsApp.create({
    data: { numeroId, contatoId: contato.id, capturadaEm, ultimaMensagemEm: capturadaEm },
  });
  return { lead, contato, conversa, capturadaEm };
}

/** Lead com experimental marcada para daqui a `emMin` minutos (negativo = já passou). */
async function seedLeadExperimental(numeroId: string, emMin: number, etapa: EtapaLead = EtapaLead.EXPERIMENTAL_AGENDADA) {
  const lead = await prisma.oportunidade.create({
    data: {
      codigo: `L-${Math.floor(Math.random() * 1e6)}`,
      nome: "Bia",
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

describe("B3 — validade do disparo (validaAte)", () => {
  it("despachante CANCELA intenção vencida (inclusive ADIADA) — nunca envia", async () => {
    const numero = await seedNumero();
    const { lead, contato } = await seedLeadExperimental(numero.id, 60);
    const politica = await seedPolitica(CHAVE_PRE_EXPERIMENTAL, CADENCIA_PRE_EXPERIMENTAL, numero.id);

    // Intenção ADIADA (ex.: janela/kill switch) cuja validade JÁ passou.
    await prisma.intencaoMensagem.create({
      data: {
        numeroId: numero.id,
        contatoId: contato.id,
        origem: "CRON",
        status: "ADIADA",
        despacharAposEm: new Date(Date.now() - 60_000),
        leadId: lead.id,
        passoComercial: "-24h",
        ocorrenciaComercial: lead.dataExperimental!.toISOString(),
        politicaComercialId: politica.id,
        corpoRenderizado: "Sua aula é amanhã!",
        validaAte: new Date(Date.now() - 30 * 60_000),
      },
    });

    const r = await despacharFila();

    expect(r.canceladas).toBe(1);
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.status).toBe("CANCELADA");
    expect(intencao.motivoFalha).toBe("validade_expirada");
  });
});

describe("B7 — revalidação de estado no DESPACHO (não só no enqueue)", () => {
  it("lead avançou de etapa depois do enqueue → intenção CANCELADA (etapa_mudou)", async () => {
    const numero = await seedNumero();
    const { lead, contato, capturadaEm } = await seedLeadFrio(numero.id, 45);
    const politica = await seedPolitica(CHAVE_LEAD_NOVO, CADENCIA_LEAD_NOVO, numero.id);

    await prisma.intencaoMensagem.create({
      data: {
        numeroId: numero.id,
        contatoId: contato.id,
        origem: "CRON",
        leadId: lead.id,
        passoComercial: "+30min",
        ocorrenciaComercial: capturadaEm.toISOString(),
        politicaComercialId: politica.id,
        corpoRenderizado: "Oi Ana!",
      },
    });
    // DEPOIS do enqueue: vendedor moveu o lead no funil.
    await prisma.oportunidade.update({ where: { id: lead.id }, data: { etapa: EtapaLead.EM_ATENDIMENTO } });

    const r = await despacharFila();

    expect(r.canceladas).toBe(1);
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.status).toBe("CANCELADA");
    expect(intencao.motivoFalha).toBe("etapa_comercial_alterada");
  });

  it("saída manual (fromMe) depois do enqueue → CANCELADA (vendedor_assumiu)", async () => {
    const numero = await seedNumero();
    const { lead, contato, conversa, capturadaEm } = await seedLeadFrio(numero.id, 45);
    const politica = await seedPolitica(CHAVE_LEAD_NOVO, CADENCIA_LEAD_NOVO, numero.id);

    await prisma.intencaoMensagem.create({
      data: {
        numeroId: numero.id,
        contatoId: contato.id,
        origem: "CRON",
        leadId: lead.id,
        passoComercial: "+30min",
        ocorrenciaComercial: capturadaEm.toISOString(),
        politicaComercialId: politica.id,
        corpoRenderizado: "Oi Ana!",
      },
    });
    await prisma.mensagemWhatsApp.create({
      data: {
        conversaId: conversa.id,
        numeroId: numero.id,
        direcao: "SAIDA",
        tipo: "TEXTO",
        corpo: "resposta do celular",
        status: "ENVIADA",
        driver: DriverWhatsApp.BAILEYS,
        origem: null, // fromMe fora do ERP
        providerMessageId: "wamid-fromme-2",
        criadoEm: new Date(capturadaEm.getTime() + 40 * 60_000),
      },
    });

    const r = await despacharFila();

    expect(r.canceladas).toBe(1);
    expect((await prisma.intencaoMensagem.findFirstOrThrow()).motivoFalha).toBe("atendimento_comercial_iniciado");
  });

  it("experimental REAGENDADA depois do enqueue → CANCELADA (ocorrencia_mudou)", async () => {
    const numero = await seedNumero();
    const { lead, contato } = await seedLeadExperimental(numero.id, 60);
    const politica = await seedPolitica(CHAVE_PRE_EXPERIMENTAL, CADENCIA_PRE_EXPERIMENTAL, numero.id);
    const ocorrenciaAntiga = lead.dataExperimental!.toISOString();

    await prisma.intencaoMensagem.create({
      data: {
        numeroId: numero.id,
        contatoId: contato.id,
        origem: "CRON",
        leadId: lead.id,
        passoComercial: "-2h",
        ocorrenciaComercial: ocorrenciaAntiga,
        politicaComercialId: politica.id,
        corpoRenderizado: "É daqui a pouco!",
        validaAte: new Date(Date.now() + 60 * 60_000), // ainda válida — o gatilho é a ocorrência
      },
    });
    // Remarcou para outro dia (etapa continua EXPERIMENTAL_AGENDADA).
    await prisma.oportunidade.update({
      where: { id: lead.id },
      data: { dataExperimental: new Date(Date.now() + 72 * 3600_000) },
    });

    const r = await despacharFila();

    expect(r.canceladas).toBe(1);
    expect((await prisma.intencaoMensagem.findFirstOrThrow()).motivoFalha).toBe("ocorrencia_comercial_alterada");
  });
});
