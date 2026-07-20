import { describe, it, expect, beforeEach } from "vitest";
import { EtapaLead, type EstadoPolitica } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario } from "@/test/integracao";
import { CADENCIA_LEAD_NOVO, CHAVE_LEAD_NOVO } from "@/server/comercial/regua-fabrica";
import { rodarLeadNovoSemResposta } from "./cron-comercial";
import { despacharFila } from "./despachante";
import { enfileirarIntencaoComercial } from "./fila";

// Integração E6/C1 — régua "lead novo sem resposta" (doc 27). Sem WHATSAPP_LIVE → o
// despacho vira SIMULADA. Cobre: dispara o degrau devido, stop-conditions (etapa/resposta),
// idempotência, trava S1 LIBERADA no Baileys, forward-only ponta a ponta.

let dono: Awaited<ReturnType<typeof criarUsuario>>;

beforeEach(async () => {
  await truncarBanco();
  dono = await criarUsuario([]);
});

async function seedReguaComercial(estado: EstadoPolitica) {
  const numero = await prisma.numeroWhatsApp.create({
    data: { telefoneE164: "+5511988887777", rotulo: "Vendas", driver: "BAILEYS", finalidade: "VENDAS", providerRef: "inst-v", donoId: dono.id },
  });
  const politica = await prisma.politicaComercial.create({
    data: {
      chave: CHAVE_LEAD_NOVO,
      nome: "Lead novo",
      estado,
      janelaInicio: 0,
      janelaFim: 24,
      diasSemana: [0, 1, 2, 3, 4, 5, 6],
      numeroRemetenteId: numero.id,
      degraus: {
        create: CADENCIA_LEAD_NOVO.map((d) => ({
          passo: d.passo,
          offsetMinutos: d.offsetMinutos,
          rotulo: d.rotulo,
          ativo: true,
        })),
      },
    },
  });
  return { numero, politica };
}

async function seedLeadFrio(numeroId: string, capturadaHaMin: number, etapa: EtapaLead = EtapaLead.NOVO) {
  const lead = await prisma.lead.create({ data: { codigo: `L-${Math.floor(Math.random() * 1e6)}`, nome: "Maria", etapa, vendedorDonoId: dono.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: `+5069${Math.floor(Math.random() * 1e7)}`, leadId: lead.id } });
  const capturadaEm = new Date(Date.now() - capturadaHaMin * 60_000);
  const conversa = await prisma.conversaWhatsApp.create({
    data: { numeroId, contatoId: contato.id, capturadaEm, ultimaMensagemEm: capturadaEm },
  });
  // A âncora é o 1º inbound (registra a mensagem de entrada na conversa).
  await prisma.mensagemWhatsApp.create({
    data: { conversaId: conversa.id, numeroId, direcao: "ENTRADA", corpo: "oi", driver: "BAILEYS", criadoEm: capturadaEm },
  });
  return { lead, contato, conversa };
}

describe("rodarLeadNovoSemResposta", () => {
  it("política DESLIGADA → não roda", async () => {
    const { numero } = await seedReguaComercial("DESLIGADA");
    await seedLeadFrio(numero.id, 45);
    const r = await rodarLeadNovoSemResposta();
    expect(r.executou).toBe(false);
    expect(r.motivoParada).toBe("politica_desligada");
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("lead frio há 45min → enfileira o +30min; despacho vira SIMULADA (shadow)", async () => {
    const { numero } = await seedReguaComercial("SHADOW");
    const { lead } = await seedLeadFrio(numero.id, 45);

    const r = await rodarLeadNovoSemResposta();
    expect(r.acoesDevidas).toBe(1);
    expect(r.enfileiradas).toBe(1);

    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.leadId).toBe(lead.id);
    expect(intencao.passoComercial).toBe("+30min");
    expect(intencao.corpoRenderizado).toContain("Maria"); // {nome} renderizado

    await despacharFila();
    const depois = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(depois.status).toBe("SIMULADA"); // shadow — não envia; NÃO cancelada por S1 (Baileys)
    expect(depois.motivoFalha).not.toBe("trava_driver_oficial");
  });

  it("lead ainda novo há 10min → futuro (o +30min não chegou), nada enfileirado", async () => {
    const { numero } = await seedReguaComercial("SHADOW");
    await seedLeadFrio(numero.id, 10);
    const r = await rodarLeadNovoSemResposta();
    expect(r.enfileiradas).toBe(0);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("stop: lead respondeu (2º inbound depois da âncora) → encerrada, nada enfileirado", async () => {
    const { numero } = await seedReguaComercial("SHADOW");
    const { conversa } = await seedLeadFrio(numero.id, 45);
    await prisma.mensagemWhatsApp.create({
      data: { conversaId: conversa.id, numeroId: numero.id, direcao: "ENTRADA", corpo: "tenho interesse", driver: "BAILEYS" },
    });
    const r = await rodarLeadNovoSemResposta();
    expect(r.encerrados).toBe(1);
    expect(r.enfileiradas).toBe(0);
  });

  it("stop: etapa avançou (QUALIFICADO) → encerrada", async () => {
    const { numero } = await seedReguaComercial("SHADOW");
    await seedLeadFrio(numero.id, 45, EtapaLead.QUALIFICADO);
    const r = await rodarLeadNovoSemResposta();
    expect(r.encerrados).toBe(1);
    expect(r.enfileiradas).toBe(0);
  });

  // EM_ATENDIMENTO significa que o vendedor JÁ assumiu o lead (review PR #55 P1): só NOVO
  // é "frio". A automação não pode falar por cima do humano só porque ele ainda não mandou
  // a primeira mensagem pelo canal — a etapa basta para encerrar a cadência.
  it("stop: etapa EM_ATENDIMENTO (vendedor assumiu) → encerrada, nada enfileirado", async () => {
    const { numero } = await seedReguaComercial("SHADOW");
    await seedLeadFrio(numero.id, 45, EtapaLead.EM_ATENDIMENTO);
    const r = await rodarLeadNovoSemResposta();
    expect(r.encerrados).toBe(1);
    expect(r.acoesDevidas).toBe(0);
    expect(r.enfileiradas).toBe(0);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("stop: opt-out do contato → nem entra na varredura", async () => {
    const { numero } = await seedReguaComercial("SHADOW");
    const { contato } = await seedLeadFrio(numero.id, 45);
    await prisma.contatoWhatsApp.update({ where: { id: contato.id }, data: { optOutEm: new Date() } });
    const r = await rodarLeadNovoSemResposta();
    expect(r.leadsAvaliados).toBe(0);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("idempotência: passo já cumprido (evento) não re-enfileira", async () => {
    const { numero } = await seedReguaComercial("SHADOW");
    const { lead } = await seedLeadFrio(numero.id, 45);
    await prisma.evento.create({
      data: { tipo: "ReguaComercialEnviada", agregadoTipo: "Lead", agregadoId: lead.id, payload: { chave: CHAVE_LEAD_NOVO, passo: "+30min", canal: "api" } },
    });
    const r = await rodarLeadNovoSemResposta();
    // +30min feito → aos 45min o +4h ainda não chegou → futuro; nada devido.
    expect(r.enfileiradas).toBe(0);
    expect(r.acoesDevidas).toBe(0);
  });

  it("forward-only ponta a ponta: +30min cumprido, aos 5h o devido é +4h (não volta)", async () => {
    const { numero } = await seedReguaComercial("SHADOW");
    const { lead } = await seedLeadFrio(numero.id, 300); // 5h
    await prisma.evento.create({
      data: { tipo: "ReguaComercialEnviada", agregadoTipo: "Lead", agregadoId: lead.id, payload: { chave: CHAVE_LEAD_NOVO, passo: "+30min", canal: "api" } },
    });
    const r = await rodarLeadNovoSemResposta();
    expect(r.enfileiradas).toBe(1);
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.passoComercial).toBe("+4h");
  });
});

// A idempotência do outbox comercial é [politicaComercialId, leadId, passoComercial] — a
// POLÍTICA faz parte da chave (review PR #55 P2). "Um motor, N políticas" (doc 27 §Tese) só
// se sustenta se cadências distintas puderem reusar nomes de passo (+30min/+3d/+7d existem
// em lead-novo e no-show) sem uma bloquear a outra no MESMO lead.
describe("enfileirarIntencaoComercial × identidade da política", () => {
  const degrauBase = {
    passoComercial: "+30min",
    corpoRenderizado: "Oi Maria!",
    variaveis: [] as string[],
    templateId: null,
  };

  it("políticas DIFERENTES com o mesmo passo no mesmo lead: as duas enfileiram", async () => {
    const { numero, politica } = await seedReguaComercial("SHADOW");
    const outra = await prisma.politicaComercial.create({
      data: {
        chave: "NO_SHOW_SEM_RESPOSTA",
        nome: "No-show sem resposta",
        estado: "SHADOW",
        janelaInicio: 0,
        janelaFim: 24,
        diasSemana: [0, 1, 2, 3, 4, 5, 6],
        numeroRemetenteId: numero.id,
      },
    });
    const { lead, contato } = await seedLeadFrio(numero.id, 45);
    const comum = { ...degrauBase, leadId: lead.id, numeroId: numero.id, contatoId: contato.id };

    const primeira = await prisma.$transaction((tx) =>
      enfileirarIntencaoComercial(tx, { ...comum, politicaComercialId: politica.id }),
    );
    const segunda = await prisma.$transaction((tx) =>
      enfileirarIntencaoComercial(tx, { ...comum, politicaComercialId: outra.id }),
    );

    expect(primeira).toBe("criada");
    expect(segunda).toBe("criada"); // não é "ja_existente": a chave inclui a política
    expect(await prisma.intencaoMensagem.count()).toBe(2);
  });

  it("contra-prova: a MESMA política + passo no mesmo lead não re-enfileira", async () => {
    const { numero, politica } = await seedReguaComercial("SHADOW");
    const { lead, contato } = await seedLeadFrio(numero.id, 45);
    const comum = { ...degrauBase, leadId: lead.id, numeroId: numero.id, contatoId: contato.id, politicaComercialId: politica.id };

    expect(await prisma.$transaction((tx) => enfileirarIntencaoComercial(tx, comum))).toBe("criada");
    expect(await prisma.$transaction((tx) => enfileirarIntencaoComercial(tx, comum))).toBe("ja_existente");
    expect(await prisma.intencaoMensagem.count()).toBe(1);
  });
});
