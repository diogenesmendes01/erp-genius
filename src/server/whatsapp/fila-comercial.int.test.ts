import { describe, it, expect, beforeEach } from "vitest";
import { EtapaLead, type EstadoPolitica } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario } from "@/test/integracao";
import { CADENCIA_LEAD_NOVO, CHAVE_LEAD_NOVO } from "@/server/comercial/regua-fabrica";
import { enfileirarIntencaoComercial } from "./fila";

// Integração E6/C1 — a idempotência do outbox comercial inclui a política. Sem WHATSAPP_LIVE.

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
        // B1 (doc 32): estas suites cobrem o comportamento GERAL — go-live explícito.
        modoPiloto: false,
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
  const telefoneE164 = `+5069${Math.floor(Math.random() * 1e7)}`;
  const lead = await prisma.lead.create({ data: { codigo: `L-${Math.floor(Math.random() * 1e6)}`, nome: "Maria", telefoneE164, etapa, vendedorDonoId: dono.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164, leadId: lead.id } });
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

// A idempotência do outbox comercial é [politicaComercialId, leadId, passoComercial] — a
// POLÍTICA faz parte da chave (review PR #55 P2). "Um motor, N políticas" (doc 27 §Tese) só
// se sustenta se cadências distintas puderem reusar nomes de passo (+30min/+3d/+7d existem
// em lead-novo e no-show) sem uma bloquear a outra no MESMO lead.
describe("enfileirarIntencaoComercial × identidade da política", () => {
  const degrauBase = {
    passoComercial: "+30min",
    // A OCORRÊNCIA (âncora em ISO) entra na chave desde a #56; aqui é fixa porque o que se
    // testa é a dimensão POLÍTICA da unicidade.
    ocorrenciaComercial: "2026-01-01T12:00:00.000Z",
    corpoRenderizado: "Oi Maria!",
    variaveis: [] as string[],
    templateId: null,
    validaAte: null,
  };

  it("políticas DIFERENTES com o mesmo passo no mesmo lead: as duas enfileiram", async () => {
    const { numero, politica } = await seedReguaComercial("SHADOW");
    const outra = await prisma.politicaComercial.create({
      data: {
        // B1 (doc 32): estas suites cobrem o comportamento GERAL — go-live explícito.
        modoPiloto: false,
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
