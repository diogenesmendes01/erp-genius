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
import { capturarRespostaExperimental } from "@/server/comercial/captura";
import { rodarCheckInVencido, rodarLeadNovoSemResposta, rodarPreExperimental } from "./cron-comercial";
import { despacharFila } from "./despachante";

// BLOQUEADORES DO PILOTO (doc 32 §0) — B1 cohort, B2 takeover manual, B3 validade,
// B7 revalidação no despacho, B8 pausa por reagendamento, B9 check-in vencido.

let dono: Awaited<ReturnType<typeof criarUsuario>>;

beforeEach(async () => {
  await truncarBanco();
  dono = await criarUsuario([]);
});

async function seedNumero() {
  return prisma.numeroWhatsApp.create({
    data: { telefoneE164: "+5511900001111", rotulo: "Vendas", driver: "BAILEYS", finalidade: "VENDAS", providerRef: "inst-piloto", donoId: dono.id },
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
  const lead = await prisma.lead.create({
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
  const lead = await prisma.lead.create({
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

describe("B1 — cohort real (allowlist do piloto)", () => {
  it("modo piloto: só o lead da allowlist enfileira; o resto conta em foraDoPiloto", async () => {
    const numero = await seedNumero();
    const dentro = await seedLeadFrio(numero.id, 45, "-dentro");
    const fora = await seedLeadFrio(numero.id, 45, "-fora");
    await seedPolitica(CHAVE_LEAD_NOVO, CADENCIA_LEAD_NOVO, numero.id, {
      modoPiloto: true,
      pilotoLeadIds: [dentro.lead.id],
    });

    const r = await rodarLeadNovoSemResposta();

    expect(r.enfileiradas).toBe(1);
    expect(r.foraDoPiloto).toBe(1);
    const intencoes = await prisma.intencaoMensagem.findMany();
    expect(intencoes).toHaveLength(1);
    expect(intencoes[0].leadId).toBe(dentro.lead.id);
    expect(intencoes[0].leadId).not.toBe(fora.lead.id);
  });

  it("modo piloto com lista VAZIA = ninguém recebe (ligar a régua não é go-live)", async () => {
    const numero = await seedNumero();
    await seedLeadFrio(numero.id, 45);
    await seedPolitica(CHAVE_LEAD_NOVO, CADENCIA_LEAD_NOVO, numero.id, { modoPiloto: true });

    const r = await rodarLeadNovoSemResposta();

    expect(r.enfileiradas).toBe(0);
    expect(r.foraDoPiloto).toBe(1);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });
});

describe("B2 — saída manual pelo celular (origem null) conta como takeover", () => {
  it("mensagem SAIDA sem origem (fromMe) após a âncora encerra a cadência", async () => {
    const numero = await seedNumero();
    const { lead, conversa, capturadaEm } = await seedLeadFrio(numero.id, 45);
    await seedPolitica(CHAVE_LEAD_NOVO, CADENCIA_LEAD_NOVO, numero.id);

    // Vendedor respondeu pelo APP do celular: entra no log como SAIDA com origem null (gap 16).
    await prisma.mensagemWhatsApp.create({
      data: {
        conversaId: conversa.id,
        numeroId: numero.id,
        direcao: "SAIDA",
        tipo: "TEXTO",
        corpo: "Oi! Já te respondo por aqui.",
        status: "ENVIADA",
        driver: "BAILEYS",
        origem: null,
        providerMessageId: "wamid-fromme-1",
        criadoEm: new Date(capturadaEm.getTime() + 5 * 60_000),
      },
    });

    const r = await rodarLeadNovoSemResposta();

    expect(r.enfileiradas).toBe(0);
    expect(r.encerrados).toBe(1);
    expect(lead.etapa).toBe(EtapaLead.NOVO); // nem precisou mudar etapa — a saída manual basta
  });
});

describe("B3 — validade do disparo (validaAte)", () => {
  it("intenção pré-evento nasce com validaAte ≤ horário da aula", async () => {
    const numero = await seedNumero();
    const { lead } = await seedLeadExperimental(numero.id, 180); // aula em 3h → degrau -24h devido
    await seedPolitica(CHAVE_PRE_EXPERIMENTAL, CADENCIA_PRE_EXPERIMENTAL, numero.id);

    await rodarPreExperimental();

    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.leadId).toBe(lead.id);
    expect(intencao.validaAte).not.toBeNull();
    expect(intencao.validaAte!.getTime()).toBeLessThanOrEqual(lead.dataExperimental!.getTime());
  });

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
    await prisma.lead.update({ where: { id: lead.id }, data: { etapa: EtapaLead.EM_ATENDIMENTO } });

    const r = await despacharFila();

    expect(r.canceladas).toBe(1);
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.status).toBe("CANCELADA");
    expect(intencao.motivoFalha).toBe("etapa_mudou");
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
        driver: "BAILEYS",
        origem: null, // fromMe fora do ERP
        providerMessageId: "wamid-fromme-2",
        criadoEm: new Date(capturadaEm.getTime() + 40 * 60_000),
      },
    });

    const r = await despacharFila();

    expect(r.canceladas).toBe(1);
    expect((await prisma.intencaoMensagem.findFirstOrThrow()).motivoFalha).toBe("vendedor_assumiu");
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
    await prisma.lead.update({
      where: { id: lead.id },
      data: { dataExperimental: new Date(Date.now() + 72 * 3600_000) },
    });

    const r = await despacharFila();

    expect(r.canceladas).toBe(1);
    expect((await prisma.intencaoMensagem.findFirstOrThrow()).motivoFalha).toBe("ocorrencia_mudou");
  });
});

describe("B8 — REAGENDAR pausa a cadência até a ação humana", () => {
  it("pedido de reagendamento grava o estado e o cron pré-experimental para de enfileirar", async () => {
    const numero = await seedNumero();
    const { lead } = await seedLeadExperimental(numero.id, 180);
    await seedPolitica(CHAVE_PRE_EXPERIMENTAL, CADENCIA_PRE_EXPERIMENTAL, numero.id);

    // A pergunta foi feita (lembrete enviado) — pré-condição da captura da resposta.
    await prisma.evento.create({
      data: {
        tipo: "ReguaComercialEnviada",
        agregadoTipo: "Lead",
        agregadoId: lead.id,
        payload: { chave: CHAVE_PRE_EXPERIMENTAL, passo: "-24h", ocorrencia: lead.dataExperimental!.toISOString() },
        criadoEm: new Date(Date.now() - 60_000),
      },
    });

    const resposta = await prisma.$transaction((tx) =>
      capturarRespostaExperimental(tx, { leadId: lead.id, corpo: "REAGENDAR", quando: new Date() }),
    );
    expect(resposta).toBe("reagendar");

    const leadDepois = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(leadDepois.aguardandoReagendamentoEm).not.toBeNull();

    // O tick seguinte NÃO re-enfileira o próximo degrau (falha conhecida do doc 32 B8).
    const r = await rodarPreExperimental();
    expect(r.enfileiradas).toBe(0);
    expect(r.encerrados).toBe(1);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("remarcar (agendarExperimental) limpa o estado e a cadência volta para a ocorrência nova", async () => {
    const numero = await seedNumero();
    const { lead } = await seedLeadExperimental(numero.id, 180);
    await seedPolitica(CHAVE_PRE_EXPERIMENTAL, CADENCIA_PRE_EXPERIMENTAL, numero.id);
    await prisma.lead.update({
      where: { id: lead.id },
      data: { aguardandoReagendamentoEm: new Date() },
    });

    // O que `agendarExperimental` grava no banco ao remarcar (a ação exige sessão — aqui
    // valida-se o CONTRATO de dados que ela persiste).
    // Aula nova daqui a 20h: o degrau -24h JÁ é devido para a ocorrência nova.
    const novaData = new Date(Date.now() + 20 * 3600_000);
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        etapa: EtapaLead.EXPERIMENTAL_AGENDADA,
        dataExperimental: novaData,
        experimentalConfirmadaEm: null,
        aguardandoReagendamentoEm: null,
      },
    });

    const r = await rodarPreExperimental();
    expect(r.enfileiradas).toBe(1);
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.ocorrenciaComercial).toBe(novaData.toISOString());
  });
});

describe("B9 — alerta de check-in vencido", () => {
  it("experimental já ocorrida (além da tolerância) sem check-in gera evento — uma vez só", async () => {
    const numero = await seedNumero();
    const { lead } = await seedLeadExperimental(numero.id, -60); // aula há 1h, ainda AGENDADA

    const r1 = await rodarCheckInVencido();
    expect(r1.alertados).toBe(1);

    // Idempotente por ocorrência: o tick seguinte não duplica o alerta.
    const r2 = await rodarCheckInVencido();
    expect(r2.alertados).toBe(0);
    expect(r2.jaAlertados).toBe(1);

    const eventos = await prisma.evento.findMany({ where: { tipo: "ExperimentalCheckInVencido" } });
    expect(eventos).toHaveLength(1);
    expect(eventos[0].agregadoId).toBe(lead.id);
  });

  it("dentro da tolerância (30min default) ainda não alerta", async () => {
    const numero = await seedNumero();
    await seedLeadExperimental(numero.id, -10); // aula há 10min

    const r = await rodarCheckInVencido();
    expect(r.avaliados).toBe(0);
    expect(await prisma.evento.count({ where: { tipo: "ExperimentalCheckInVencido" } })).toBe(0);
  });
});
