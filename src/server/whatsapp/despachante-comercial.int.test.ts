import { DriverWhatsApp } from "@prisma/client";
import { describe, it, expect, beforeEach } from "vitest";
import type { EstadoPolitica } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { agoraAs } from "@/test/integracao-whatsapp";
import { CHAVE_LEAD_NOVO } from "@/server/comercial/regua-fabrica";
import { despacharFila } from "./despachante";
import { garantirAtendimento } from "./atendimentos";

// Integração dos GUARD-RAILS do despachante no caminho COMERCIAL (doc 27 · review PR #55).
// Sem WHATSAPP_LIVE: tudo que ATRAVESSA os guard-rails morre no shadow como SIMULADA — é
// exatamente o que estes testes usam como prova de "passou" (o oposto de ADIADA/CANCELADA).
// Cada caso vem com a CONTRA-PROVA (o cenário vizinho em que o guard-rail DEVE agir), para
// que uma regra frouxa demais não passe despercebida.

beforeEach(async () => {
  await truncarBanco();
});

interface SeedComercial {
  estado?: EstadoPolitica;
  chave?: string;
  janela?: [number, number];
  teto?: number;
  /** Fuso do PAÍS do lead; ausente = lead sem país (o despachante cai no default de SP). */
  fusoLead?: string;
}

async function seedComercial(over: SeedComercial = {}) {
  const numero = await prisma.numeroWhatsApp.create({
    data: { telefoneE164: "+5511955554444", rotulo: "Vendas", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS", providerRef: "inst-dc" },
  });
  const pais = over.fusoLead
    ? await prisma.pais.create({
        data: { nome: "Japão", codigoISO: "JP", moedaLocal: "JPY", ddi: "+81", fuso: over.fusoLead, status: "ATIVO" },
      })
    : null;
  const lead = await prisma.oportunidade.create({ data: { codigo: "L-000900", nome: "Ana", telefoneE164: "+50699998888", paisId: pais?.id ?? null } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50699998888", leadId: lead.id } });
  const politica = await prisma.politicaComercial.create({
    data: {
        // B1 (doc 32): estas suites cobrem o comportamento GERAL — go-live explícito.
        modoPiloto: false,
      chave: over.chave ?? CHAVE_LEAD_NOVO,
      nome: "Lead novo",
      estado: over.estado ?? "SHADOW",
      janelaInicio: over.janela?.[0] ?? 0,
      janelaFim: over.janela?.[1] ?? 24,
      diasSemana: [0, 1, 2, 3, 4, 5, 6],
      tetoPorContatoDia: over.teto ?? 2,
      silencioPosInboundHoras: 72,
      numeroRemetenteId: numero.id,
    },
  });
  return { numero, pais, lead, contato, politica };
}

// OCORRÊNCIA (review PR #56): a âncora do ciclo em ISO. Toda intenção comercial carrega a
// sua, e o guard-rail 6b só reconhece como "degrau cumprido" o evento do MESMO ciclo.
const OCORRENCIA = "2026-03-10T14:00:00.000Z";

/** Intenção da cadência comercial já pronta na outbox (o enfileirador é testado à parte). */
async function enfileirarDegrau(
  ctx: Awaited<ReturnType<typeof seedComercial>>,
  passo = "+30min",
  ocorrencia = OCORRENCIA,
) {
  const conversa = await prisma.conversaWhatsApp.upsert({
    where: { numeroId_contatoId: { numeroId: ctx.numero.id, contatoId: ctx.contato.id } },
    create: { numeroId: ctx.numero.id, contatoId: ctx.contato.id, capturadaEm: new Date(ocorrencia) }, update: {},
  });
  if (!conversa.capturadaEm) await prisma.conversaWhatsApp.update({ where: { id: conversa.id }, data: { capturadaEm: new Date(ocorrencia) } });
  const atendimento = await prisma.$transaction((tx) => garantirAtendimento(tx, {
    numeroId: ctx.numero.id, contatoId: ctx.contato.id, finalidade: "COMERCIAL", leadId: ctx.lead.id,
  }));
  return prisma.intencaoMensagem.create({
    data: {
      numeroId: ctx.numero.id,
      atendimentoId: atendimento.id,
      contatoId: ctx.contato.id,
      origem: "CRON",
      leadId: ctx.lead.id,
      passoComercial: passo,
      ocorrenciaComercial: conversa.capturadaEm?.toISOString() ?? ocorrencia,
      politicaComercialId: ctx.politica.id,
      corpoRenderizado: "Oi Ana!",
    },
  });
}

/** Evento de degrau cumprido, como o despachante o grava (chave + passo + ocorrência). */
async function eventoDegrauEnviado(
  ctx: Awaited<ReturnType<typeof seedComercial>>,
  payload: { chave: string; passo: string; ocorrencia: string },
) {
  return prisma.evento.create({
    data: {
      tipo: "ReguaComercialEnviada",
      agregadoTipo: "Lead",
      agregadoId: ctx.lead.id,
      payload: { ...payload, canal: "api" },
    },
  });
}

describe("silêncio pós-inbound × inbound-ÂNCORA da cadência (review PR #55 P1)", () => {
  it("o inbound que ANCOROU a cadência não a silencia — o +30min devido SAI", async () => {
    const ctx = await seedComercial();
    // Como o webhook grava de verdade: capturadaEm (âncora) e ultimoInboundEm no MESMO
    // instante — é o 1º (e único) inbound do lead. Nada foi "tratado" pelo humano ainda.
    const ancora = new Date(Date.now() - 45 * 60_000);
    await prisma.conversaWhatsApp.create({
      data: {
        numeroId: ctx.numero.id,
        contatoId: ctx.contato.id,
        capturadaEm: ancora,
        ultimoInboundEm: ancora,
        ultimaMensagemEm: ancora,
        inboundTratadoEm: null,
      },
    });
    await enfileirarDegrau(ctx);

    const r = await despacharFila();
    expect(r.adiadas).toBe(0);
    expect(r.simuladas).toBe(1); // atravessou o S4 e morreu no shadow (sem WHATSAPP_LIVE)

    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.status).toBe("SIMULADA");
    expect(intencao.motivoFalha).not.toBe("silencio_pos_inbound");
  });

  it("contra-prova: inbound POSTERIOR à âncora volta a silenciar (ADIADA por 72h)", async () => {
    const ctx = await seedComercial();
    const ancora = new Date(Date.now() - 45 * 60_000);
    const respondeu = new Date(Date.now() - 10 * 60_000); // 2º inbound, depois da âncora
    await prisma.conversaWhatsApp.create({
      data: {
        numeroId: ctx.numero.id,
        contatoId: ctx.contato.id,
        capturadaEm: ancora,
        ultimoInboundEm: respondeu,
        ultimaMensagemEm: respondeu,
      },
    });
    await enfileirarDegrau(ctx);

    const r = await despacharFila();
    expect(r.adiadas).toBe(1);
    expect(r.simuladas).toBe(0);

    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.status).toBe("ADIADA");
    expect(intencao.motivoFalha).toBe("silencio_pos_inbound");
    // O adiamento é a janela de silêncio inteira contada do inbound novo (72h).
    expect(intencao.despacharAposEm?.getTime()).toBe(respondeu.getTime() + 72 * 3600_000);
  });
});

describe("janela no FUSO DO LEAD (S3 · review PR #55 P1)", () => {
  // Instante ÚNICO para os dois casos: 15:00 UTC = 12h em São Paulo (dentro de 8–18) e
  // 00h do dia seguinte em Tóquio (madrugada, fora). Só o país do lead muda entre eles.
  const AGORA = new Date("2026-03-10T15:00:00Z");

  it("madrugada no país do lead ADIA, mesmo sendo horário comercial em SP", async () => {
    const ctx = await seedComercial({ janela: [8, 18], fusoLead: "Asia/Tokyo" });
    await enfileirarDegrau(ctx);

    const r = await despacharFila(AGORA);
    expect(r.adiadas).toBe(1);

    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.status).toBe("ADIADA");
    expect(intencao.motivoFalha).toBe("fora_da_janela");
  });

  it("contra-prova: no MESMO instante, lead sem país (default SP) está dentro e sai", async () => {
    const ctx = await seedComercial({ janela: [8, 18] });
    await enfileirarDegrau(ctx);

    const r = await despacharFila(AGORA);
    expect(r.adiadas).toBe(0);
    expect(r.simuladas).toBe(1);
    expect((await prisma.intencaoMensagem.findFirstOrThrow()).motivoFalha).not.toBe("fora_da_janela");
  });
});

describe("teto por contato/dia × saudação reativa (review PR #55 P2)", () => {
  const AGORA = agoraAs(12);

  /** Uma SAÍDA automática de hoje na conversa do contato, com (ou sem) intenção reativa. */
  async function saidaDeHoje(ctx: Awaited<ReturnType<typeof seedComercial>>, reativa: boolean) {
    const conversa = await prisma.conversaWhatsApp.create({
      data: { numeroId: ctx.numero.id, contatoId: ctx.contato.id, ultimaMensagemEm: agoraAs(10) },
    });
    // A saudação é PERSISTIDA como CRON — só a INTENÇÃO que a originou sabe que ela é
    // reativa. Por isso o vínculo `mensagemId` precisa existir para o teto excluí-la.
    const mensagem = await prisma.mensagemWhatsApp.create({
      data: {
        conversaId: conversa.id,
        numeroId: ctx.numero.id,
        direcao: "SAIDA",
        corpo: "Oi Ana! Já te respondo.",
        status: "ENVIADA",
        driver: DriverWhatsApp.BAILEYS,
        origem: "CRON",
        criadoEm: agoraAs(10),
      },
    });
    await prisma.intencaoMensagem.create({
      data: {
        numeroId: ctx.numero.id,
        contatoId: ctx.contato.id,
        origem: "CRON",
        reativa,
        corpoRenderizado: "Oi Ana! Já te respondo.",
        status: "DESPACHADA",
        despachadaEm: agoraAs(10),
        mensagemId: mensagem.id,
      },
    });
  }

  it("teto 1 já 'gasto' por uma saudação REATIVA: o degrau comercial ainda sai", async () => {
    const ctx = await seedComercial({ teto: 1 });
    await saidaDeHoje(ctx, true);
    await enfileirarDegrau(ctx);

    const r = await despacharFila(AGORA);
    expect(r.adiadas).toBe(0);
    expect(r.simuladas).toBe(1);

    const intencao = await prisma.intencaoMensagem.findFirstOrThrow({
      where: { passoComercial: "+30min" },
    });
    expect(intencao.status).toBe("SIMULADA");
    expect(intencao.motivoFalha).not.toBe("teto_contato_dia");
  });

  it("contra-prova: a MESMA saída, não reativa, consome o teto e adia o degrau", async () => {
    const ctx = await seedComercial({ teto: 1 });
    await saidaDeHoje(ctx, false);
    await enfileirarDegrau(ctx);

    const r = await despacharFila(AGORA);
    expect(r.adiadas).toBe(1);

    const intencao = await prisma.intencaoMensagem.findFirstOrThrow({
      where: { passoComercial: "+30min" },
    });
    expect(intencao.status).toBe("ADIADA");
    expect(intencao.motivoFalha).toBe("teto_contato_dia");
  });
});

describe("idempotência do degrau comercial inclui a CHAVE da cadência (review PR #55 P2)", () => {
  it("evento de OUTRA cadência com o mesmo nome de passo não cancela este degrau", async () => {
    const ctx = await seedComercial(); // chave LEAD_NOVO_SEM_RESPOSTA
    // O no-show também tem um "+30min": sem a chave no filtro, ele mataria a cadência do
    // lead-novo no mesmo lead.
    await eventoDegrauEnviado(ctx, { chave: "NO_SHOW_SEM_RESPOSTA", passo: "+30min", ocorrencia: OCORRENCIA });
    await enfileirarDegrau(ctx);

    const r = await despacharFila();
    expect(r.canceladas).toBe(0);
    expect(r.simuladas).toBe(1);
    expect((await prisma.intencaoMensagem.findFirstOrThrow()).motivoFalha).not.toBe("degrau_ja_cumprido");
  });

  // ...e a OCORRÊNCIA (review PR #56). O guard-rail 6b existe porque o degrau pode ter sido
  // cumprido DEPOIS que a intenção nasceu; se ele olhasse só chave+passo, o `-24h` da
  // experimental anterior cancelaria o `-24h` da remarcada — a mesma falha que o motor já
  // corrige na hora de enfileirar, reaparecendo na hora de despachar.
  it("evento da MESMA chave + passo, mas de OUTRA ocorrência, não cancela este degrau", async () => {
    const ctx = await seedComercial();
    await eventoDegrauEnviado(ctx, {
      chave: CHAVE_LEAD_NOVO,
      passo: "+30min",
      ocorrencia: "2026-03-01T14:00:00.000Z", // ciclo anterior
    });
    await enfileirarDegrau(ctx);

    const r = await despacharFila();
    expect(r.canceladas).toBe(0);
    expect(r.simuladas).toBe(1);
    expect((await prisma.intencaoMensagem.findFirstOrThrow()).motivoFalha).not.toBe("degrau_ja_cumprido");
  });

  it("contra-prova: evento da MESMA chave + passo + ocorrência cancela (degrau já cumprido)", async () => {
    const ctx = await seedComercial();
    await eventoDegrauEnviado(ctx, { chave: CHAVE_LEAD_NOVO, passo: "+30min", ocorrencia: OCORRENCIA });
    await enfileirarDegrau(ctx);

    const r = await despacharFila();
    expect(r.canceladas).toBe(1);

    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.status).toBe("CANCELADA");
    expect(intencao.motivoFalha).toBe("degrau_ja_cumprido");
  });
});

describe("teto por contato/dia no dia civil da ESCOLA (Q176 · ref. #164)", () => {
  // Relógio fixo: o dia do teto vira à meia-noite do fuso da escola (padrão America/Sao_Paulo),
  // nunca no relógio do servidor, que em produção roda em UTC. Verde com TZ=UTC e TZ=America/Sao_Paulo.

  /** Uma saída automática (não reativa) do contato no instante dado. */
  async function saidaAutomaticaEm(ctx: Awaited<ReturnType<typeof seedComercial>>, em: Date) {
    const conversa = await prisma.conversaWhatsApp.create({
      data: { numeroId: ctx.numero.id, contatoId: ctx.contato.id, ultimaMensagemEm: em },
    });
    await prisma.mensagemWhatsApp.create({
      data: {
        conversaId: conversa.id, numeroId: ctx.numero.id, direcao: "SAIDA", corpo: "Lembrete",
        status: "ENVIADA", driver: DriverWhatsApp.BAILEYS, origem: "CRON", criadoEm: em,
      },
    });
  }

  it("às 23h30 de Brasília (02h30 UTC do dia seguinte), a saída do meio-dia ainda conta no teto do dia", async () => {
    const ctx = await seedComercial({ teto: 1 });
    await saidaAutomaticaEm(ctx, new Date("2026-03-10T15:00:00.000Z")); // 10/03, 12h de Brasília
    await enfileirarDegrau(ctx);

    const r = await despacharFila(new Date("2026-03-11T02:30:00.000Z")); // 10/03, 23h30 de Brasília
    expect(r.adiadas).toBe(1);
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow({ where: { passoComercial: "+30min" } });
    expect(intencao.status).toBe("ADIADA");
    expect(intencao.motivoFalha).toBe("teto_contato_dia");
  });

  it("contra-prova: à 00h30 de Brasília, a saída das 23h30 da véspera já não conta", async () => {
    const ctx = await seedComercial({ teto: 1 });
    await saidaAutomaticaEm(ctx, new Date("2026-03-11T02:30:00.000Z")); // 10/03, 23h30 de Brasília
    await enfileirarDegrau(ctx);

    const r = await despacharFila(new Date("2026-03-11T03:30:00.000Z")); // 11/03, 00h30 de Brasília
    expect(r.adiadas).toBe(0);
    expect(r.simuladas).toBe(1);
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow({ where: { passoComercial: "+30min" } });
    expect(intencao.status).toBe("SIMULADA");
    expect(intencao.motivoFalha).not.toBe("teto_contato_dia");
  });

  // A mensagem barrada pelo teto volta no início do dia seguinte NA ESCOLA, não 24 horas corridas depois.
  it("barrada às 23h30 de Brasília, volta à meia-noite de Brasília (03h UTC), não 24h depois", async () => {
    const ctx = await seedComercial({ teto: 1 });
    await saidaAutomaticaEm(ctx, new Date("2026-03-10T15:00:00.000Z"));
    await enfileirarDegrau(ctx);

    await despacharFila(new Date("2026-03-11T02:30:00.000Z")); // 10/03, 23h30 de Brasília
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow({ where: { passoComercial: "+30min" } });
    expect(intencao.motivoFalha).toBe("teto_contato_dia");
    expect(intencao.despacharAposEm).toEqual(new Date("2026-03-11T03:00:00.000Z"));
  });

  // C3 da revisão do #247: com janela, volta direto na abertura dela, sem a escala de adiamentos de hora em hora.
  it("barrada às 23h30 de Brasília com janela 8–18, volta às 08h de Brasília do dia seguinte (11h UTC)", async () => {
    const ctx = await seedComercial({ teto: 1, janela: [8, 18] });
    await saidaAutomaticaEm(ctx, new Date("2026-03-10T15:00:00.000Z"));
    await enfileirarDegrau(ctx);

    await despacharFila(new Date("2026-03-11T02:30:00.000Z")); // 10/03, 23h30 de Brasília
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow({ where: { passoComercial: "+30min" } });
    expect(intencao.motivoFalha).toBe("teto_contato_dia");
    expect(intencao.despacharAposEm).toEqual(new Date("2026-03-11T11:00:00.000Z"));

    // À 00h30 de Brasília ela ainda não volta à fila; às 08h sai na janela.
    expect((await despacharFila(new Date("2026-03-11T03:30:00.000Z"))).adiadas).toBe(0);
    expect(await prisma.intencaoMensagem.findFirstOrThrow({ where: { passoComercial: "+30min" } })).toMatchObject({ status: "ADIADA", motivoFalha: "teto_contato_dia" });
    expect((await despacharFila(new Date("2026-03-11T11:00:00.000Z"))).simuladas).toBe(1);
  });

  it("lead em Tóquio, janela 8–18: volta às 08h de Tóquio, depois da meia-noite da escola", async () => {
    const ctx = await seedComercial({ teto: 1, janela: [8, 18], fusoLead: "Asia/Tokyo" });
    await saidaAutomaticaEm(ctx, new Date("2026-03-10T15:00:00.000Z"));
    await enfileirarDegrau(ctx);

    // 10/03, 23h30 de Brasília = 11/03, 11h30 em Tóquio (dentro da janela, mas o teto já foi gasto no dia da escola).
    await despacharFila(new Date("2026-03-11T02:30:00.000Z"));
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow({ where: { passoComercial: "+30min" } });
    expect(intencao.motivoFalha).toBe("teto_contato_dia");
    // 00h de Brasília (03h UTC) = 12h em Tóquio, dentro da janela: o início do dia da escola é o maior.
    expect(intencao.despacharAposEm).toEqual(new Date("2026-03-11T03:00:00.000Z"));
  });

  it("escola em America/Santiago: o dia seguinte sem meia-noite (06/09/2026) começa à 01h local", async () => {
    await prisma.configuracaoOperacional.upsert({
      where: { id: "escola" }, create: { id: "escola", fusoInstitucional: "America/Santiago" }, update: { fusoInstitucional: "America/Santiago" },
    });
    const ctx = await seedComercial({ teto: 1 });
    await saidaAutomaticaEm(ctx, new Date("2026-09-05T16:00:00.000Z")); // 05/09, 12h em Santiago (−04)
    await enfileirarDegrau(ctx);

    await despacharFila(new Date("2026-09-06T03:30:00.000Z")); // 05/09, 23h30 em Santiago
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow({ where: { passoComercial: "+30min" } });
    expect(intencao.motivoFalha).toBe("teto_contato_dia");
    expect(intencao.despacharAposEm).toEqual(new Date("2026-09-06T04:00:00.000Z")); // 06/09, 01h (−03)
  });
});
