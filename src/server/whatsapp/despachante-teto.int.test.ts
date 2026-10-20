import { DriverWhatsApp } from "@prisma/client";
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { despacharFila } from "./despachante";

// Teto por contato/dia no dia civil da ESCOLA (Q176 · ref. #164), com banco real. Os casos vieram de
// `despachante-comercial.int.test.ts`, removido com a régua comercial do CRM antigo: a regra do teto é a mesma
// para toda automação, então aqui a intenção é um CRON sem cadência comercial, regido por uma PoliticaRegua.
// Sem WHATSAPP_LIVE: o que atravessa os guard-rails termina SIMULADA, que é a prova de "passou".

beforeEach(async () => {
  await truncarBanco();
});

interface Seed {
  janela?: [number, number];
  teto?: number;
  /** Fuso do PAÍS do lead; ausente = lead sem país (o despachante cai no default de SP). */
  fusoLead?: string;
}

async function seed(over: Seed = {}) {
  const numero = await prisma.numeroWhatsApp.create({
    data: { telefoneE164: "+5511955554444", rotulo: "Vendas", driver: DriverWhatsApp.MOTOR, finalidade: "VENDAS", providerRef: "inst-teto" },
  });
  const pais = over.fusoLead
    ? await prisma.pais.create({
        data: { nome: "Japão", codigoISO: "JP", moedaLocal: "JPY", ddi: "+81", fuso: over.fusoLead, status: "ATIVO" },
      })
    : null;
  const lead = await prisma.oportunidade.create({ data: { codigo: "L-000900", nome: "Ana", telefoneE164: "+50699998888", paisId: pais?.id ?? null } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50699998888", leadId: lead.id } });
  const politica = await prisma.politicaRegua.create({
    data: {
      nome: "Teto de teste",
      estado: "SHADOW",
      janelaInicio: over.janela?.[0] ?? 0,
      janelaFim: over.janela?.[1] ?? 24,
      diasSemana: [0, 1, 2, 3, 4, 5, 6],
      tetoPorContatoDia: over.teto ?? 2,
      silencioPosInboundHoras: 72,
      numeroRemetenteId: numero.id,
    },
  });
  return { numero, lead, contato, politica };
}

type Ctx = Awaited<ReturnType<typeof seed>>;

/** Intenção automática já pronta na outbox; o lead só dá o fuso do destino (S3). */
async function enfileirar(ctx: Ctx) {
  return prisma.intencaoMensagem.create({
    data: {
      numeroId: ctx.numero.id, contatoId: ctx.contato.id, origem: "CRON", leadId: ctx.lead.id,
      politicaId: ctx.politica.id, corpoRenderizado: "Oi Ana!", criadaEm: new Date("2026-03-10T14:00:00.000Z"),
    },
  });
}

/** Uma saída automática (não reativa) do contato no instante dado. */
async function saidaAutomaticaEm(ctx: Ctx, em: Date) {
  const conversa = await prisma.conversaWhatsApp.create({
    data: { numeroId: ctx.numero.id, contatoId: ctx.contato.id, ultimaMensagemEm: em },
  });
  await prisma.mensagemWhatsApp.create({
    data: {
      conversaId: conversa.id, numeroId: ctx.numero.id, direcao: "SAIDA", corpo: "Lembrete",
      status: "ENVIADA", driver: DriverWhatsApp.MOTOR, origem: "CRON", criadoEm: em,
    },
  });
}

const intencao = () => prisma.intencaoMensagem.findFirstOrThrow({ where: { corpoRenderizado: "Oi Ana!" } });

describe("teto por contato/dia no dia civil da ESCOLA (Q176 · ref. #164)", () => {
  // Relógio fixo: o dia do teto vira à meia-noite do fuso da escola (padrão America/Sao_Paulo),
  // nunca no relógio do servidor, que em produção roda em UTC. Verde com TZ=UTC e TZ=America/Sao_Paulo.

  it("às 23h30 de Brasília (02h30 UTC do dia seguinte), a saída do meio-dia ainda conta no teto do dia", async () => {
    const ctx = await seed({ teto: 1 });
    await saidaAutomaticaEm(ctx, new Date("2026-03-10T15:00:00.000Z")); // 10/03, 12h de Brasília
    await enfileirar(ctx);

    const r = await despacharFila(new Date("2026-03-11T02:30:00.000Z")); // 10/03, 23h30 de Brasília
    expect(r.adiadas).toBe(1);
    expect(await intencao()).toMatchObject({ status: "ADIADA", motivoFalha: "teto_contato_dia" });
  });

  it("contra-prova: à 00h30 de Brasília, a saída das 23h30 da véspera já não conta", async () => {
    const ctx = await seed({ teto: 1 });
    await saidaAutomaticaEm(ctx, new Date("2026-03-11T02:30:00.000Z")); // 10/03, 23h30 de Brasília
    await enfileirar(ctx);

    const r = await despacharFila(new Date("2026-03-11T03:30:00.000Z")); // 11/03, 00h30 de Brasília
    expect(r.adiadas).toBe(0);
    expect(r.simuladas).toBe(1);
    const i = await intencao();
    expect(i.status).toBe("SIMULADA");
    expect(i.motivoFalha).not.toBe("teto_contato_dia");
  });

  // A mensagem barrada pelo teto volta no início do dia seguinte NA ESCOLA, não 24 horas corridas depois.
  it("barrada às 23h30 de Brasília, volta à meia-noite de Brasília (03h UTC), não 24h depois", async () => {
    const ctx = await seed({ teto: 1 });
    await saidaAutomaticaEm(ctx, new Date("2026-03-10T15:00:00.000Z"));
    await enfileirar(ctx);

    await despacharFila(new Date("2026-03-11T02:30:00.000Z")); // 10/03, 23h30 de Brasília
    expect(await intencao()).toMatchObject({ motivoFalha: "teto_contato_dia", despacharAposEm: new Date("2026-03-11T03:00:00.000Z") });
  });

  // C3 da revisão do #247: com janela, volta direto na abertura dela, sem a escala de adiamentos de hora em hora.
  it("barrada às 23h30 de Brasília com janela 8–18, volta às 08h de Brasília do dia seguinte (11h UTC)", async () => {
    const ctx = await seed({ teto: 1, janela: [8, 18] });
    await saidaAutomaticaEm(ctx, new Date("2026-03-10T15:00:00.000Z"));
    await enfileirar(ctx);

    await despacharFila(new Date("2026-03-11T02:30:00.000Z")); // 10/03, 23h30 de Brasília
    expect(await intencao()).toMatchObject({ motivoFalha: "teto_contato_dia", despacharAposEm: new Date("2026-03-11T11:00:00.000Z") });

    // À 00h30 de Brasília ela ainda não volta à fila; às 08h sai na janela.
    expect((await despacharFila(new Date("2026-03-11T03:30:00.000Z"))).adiadas).toBe(0);
    expect(await intencao()).toMatchObject({ status: "ADIADA", motivoFalha: "teto_contato_dia" });
    expect((await despacharFila(new Date("2026-03-11T11:00:00.000Z"))).simuladas).toBe(1);
  });

  it("lead em Tóquio, janela 8–18: volta às 08h de Tóquio, depois da meia-noite da escola", async () => {
    const ctx = await seed({ teto: 1, janela: [8, 18], fusoLead: "Asia/Tokyo" });
    await saidaAutomaticaEm(ctx, new Date("2026-03-10T15:00:00.000Z"));
    await enfileirar(ctx);

    // 10/03, 23h30 de Brasília = 11/03, 11h30 em Tóquio (dentro da janela, mas o teto já foi gasto no dia da escola).
    await despacharFila(new Date("2026-03-11T02:30:00.000Z"));
    // 00h de Brasília (03h UTC) = 12h em Tóquio, dentro da janela: o início do dia da escola é o maior.
    expect(await intencao()).toMatchObject({ motivoFalha: "teto_contato_dia", despacharAposEm: new Date("2026-03-11T03:00:00.000Z") });
  });

  it("escola em America/Santiago: o dia seguinte sem meia-noite (06/09/2026) começa à 01h local", async () => {
    await prisma.configuracaoOperacional.upsert({
      where: { id: "escola" }, create: { id: "escola", fusoInstitucional: "America/Santiago" }, update: { fusoInstitucional: "America/Santiago" },
    });
    const ctx = await seed({ teto: 1 });
    await saidaAutomaticaEm(ctx, new Date("2026-09-05T16:00:00.000Z")); // 05/09, 12h em Santiago (−04)
    await enfileirar(ctx);

    await despacharFila(new Date("2026-09-06T03:30:00.000Z")); // 05/09, 23h30 em Santiago
    expect(await intencao()).toMatchObject({ motivoFalha: "teto_contato_dia", despacharAposEm: new Date("2026-09-06T04:00:00.000Z") }); // 06/09, 01h (−03)
  });
});

describe("intenções que sobraram do CRM antigo", () => {
  it("cadência comercial e gestão pendentes são canceladas no despacho, sem envio", async () => {
    const ctx = await seed();
    const comercial = await prisma.intencaoMensagem.create({ data: {
      numeroId: ctx.numero.id, contatoId: ctx.contato.id, origem: "CRON", leadId: ctx.lead.id,
      passoComercial: "+30min", ocorrenciaComercial: "2026-03-10T14:00:00.000Z", corpoRenderizado: "Degrau antigo",
    } });
    const gestao = await prisma.intencaoMensagem.create({ data: {
      numeroId: ctx.numero.id, contatoId: ctx.contato.id, origem: "GESTAO", corpoRenderizado: "Relatório antigo",
    } });

    const r = await despacharFila(new Date("2026-03-10T15:00:00.000Z"));
    expect(r.canceladas).toBe(2);
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: comercial.id } })).toMatchObject({ status: "CANCELADA", motivoFalha: "politica_comercial_alterada" });
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: gestao.id } })).toMatchObject({ status: "CANCELADA", motivoFalha: "configuracao_gestao_alterada" });
  });
});
