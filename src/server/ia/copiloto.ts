import type { GatilhoSugestaoIA, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { destinosManuaisPermitidos } from "@/server/_shared";
import { driverClaude } from "./driver-claude";
import { driverSimulado } from "./driver-simulado";
import type { AnaliseLead, ContextoAnalise, DriverIA } from "./tipos";

// ORQUESTRADOR do copiloto (C3, doc 27): monta o contexto, chama o driver e persiste as
// sugestões (uma linha por TIPO — a decisão humana por tipo é a métrica-gate). Nada aqui
// muda o CRM: aplicar é trabalho das AÇÕES (ia/acoes.ts), com sessão e guards.

/** Driver ativo: Claude com chave no env; heurística local sem chave (app sempre operável). */
export function driverIA(): DriverIA {
  return process.env.ANTHROPIC_API_KEY ? driverClaude : driverSimulado;
}

export async function copilotoLigado(): Promise<boolean> {
  const config = await prisma.configComercial.findUnique({ where: { id: "comercial" } });
  return config?.copilotoAtivo ?? false;
}

/** Contexto da análise: lead + últimas mensagens da conversa mais ativa + notas internas. */
async function montarContexto(leadId: string): Promise<ContextoAnalise | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      contatosWhatsApp: {
        include: {
          conversas: { orderBy: { ultimaMensagemEm: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!lead) return null;

  const conversa = lead.contatosWhatsApp.flatMap((c) => c.conversas).sort((a, b) =>
    (b.ultimaMensagemEm?.getTime() ?? 0) - (a.ultimaMensagemEm?.getTime() ?? 0),
  )[0];

  const mensagens = conversa
    ? await prisma.mensagemWhatsApp.findMany({
        where: { conversaId: conversa.id, corpo: { not: null } },
        orderBy: { criadoEm: "desc" },
        take: 30,
        select: { direcao: true, corpo: true, criadoEm: true },
      })
    : [];

  const notas = await prisma.evento.findMany({
    where: { agregadoTipo: "Lead", agregadoId: leadId, tipo: "NotaInterna" },
    orderBy: { criadoEm: "desc" },
    take: 5,
    select: { payload: true },
  });

  return {
    lead: {
      nome: lead.nome,
      etapa: lead.etapa,
      temperatura: lead.temperatura,
      segmento: lead.segmento,
      b2b: lead.b2b,
      criadoEmISO: lead.criadoEm.toISOString(),
      dataExperimentalISO: lead.dataExperimental?.toISOString() ?? null,
      resumoAtual: {
        interesse: lead.interesse,
        objetivo: lead.objetivo,
        urgencia: lead.urgencia,
        orcamento: lead.orcamento,
        objecao: lead.objecao,
        proximaAcao: lead.proximaAcao,
      },
      etapasPermitidas: destinosManuaisPermitidos(lead.etapa),
    },
    mensagens: mensagens.reverse().map((m) => ({
      direcao: m.direcao === "ENTRADA" ? ("ENTRADA" as const) : ("SAIDA" as const),
      corpo: m.corpo ?? "",
      quandoISO: m.criadoEm.toISOString(),
    })),
    notasInternas: notas
      .map((n) => (n.payload as { nota?: string } | null)?.nota ?? "")
      .filter(Boolean),
  };
}

export interface ResultadoGeracao {
  loteId: string | null;
  geradas: number;
  motivo: string | null; // por que nada foi gerado
}

/**
 * Gera (e persiste) as sugestões de UMA análise do lead. Sugestões PENDENTES anteriores do
 * lead viram EXPIRADAS — só o lote mais novo fica em decisão (a conversa andou; sugerir por
 * cima de contexto velho confunde e polui a métrica).
 */
export async function gerarSugestoesParaLead(
  leadId: string,
  gatilho: GatilhoSugestaoIA,
  opts: { ancoraInbound?: Date | null } = {},
): Promise<ResultadoGeracao> {
  const ctx = await montarContexto(leadId);
  if (!ctx) return { loteId: null, geradas: 0, motivo: "lead_inexistente" };
  if (ctx.mensagens.length === 0 && gatilho !== "SOB_DEMANDA") {
    return { loteId: null, geradas: 0, motivo: "sem_conversa" };
  }

  const driver = driverIA();
  let analise: AnaliseLead;
  try {
    analise = await driver.analisar(ctx);
  } catch (e) {
    console.error("[copiloto] driver falhou:", e);
    return { loteId: null, geradas: 0, motivo: "driver_falhou" };
  }

  // Revalida a etapa contra a máquina (defesa em profundidade — o driver já recebeu a lista).
  const etapaValida =
    analise.etapaSugerida && ctx.lead.etapasPermitidas.includes(analise.etapaSugerida)
      ? analise.etapaSugerida
      : null;

  const sugestoes: { tipo: "RESUMO" | "TEMPERATURA" | "SEGMENTO" | "ETAPA"; payload: Prisma.InputJsonValue }[] = [];
  if (analise.resumo) sugestoes.push({ tipo: "RESUMO", payload: { resumo: { ...analise.resumo } } });
  if (analise.temperatura) sugestoes.push({ tipo: "TEMPERATURA", payload: { temperatura: analise.temperatura } });
  if (analise.segmento) sugestoes.push({ tipo: "SEGMENTO", payload: { segmento: analise.segmento } });
  if (etapaValida) sugestoes.push({ tipo: "ETAPA", payload: { etapa: etapaValida } });

  if (sugestoes.length === 0) return { loteId: null, geradas: 0, motivo: "nada_a_sugerir" };

  const loteId = randomUUID();
  await prisma.$transaction(async (tx) => {
    await tx.sugestaoIA.updateMany({
      where: { leadId, status: "PENDENTE" },
      data: { status: "EXPIRADA", decididaEm: new Date() },
    });
    for (const s of sugestoes) {
      await tx.sugestaoIA.create({
        data: {
          leadId,
          loteId,
          tipo: s.tipo,
          gatilho,
          payload: s.payload,
          justificativa: analise.justificativa,
          modelo: driver.nome,
          ancoraInbound: opts.ancoraInbound ?? null,
        },
      });
    }
    await tx.evento.create({
      data: {
        tipo: "SugestaoIAGerada",
        agregadoTipo: "Lead",
        agregadoId: leadId,
        autorId: null, // sistema
        payload: { loteId, gatilho, tipos: sugestoes.map((s) => s.tipo), modelo: driver.nome },
      },
    });
  });

  return { loteId, geradas: sugestoes.length, motivo: null };
}

/**
 * Gatilho MUDANÇA DE ETAPA (doc 27): chamado após uma transição de funil. Nunca propaga
 * erro (a mutação principal já foi commitada) e é no-op com o copiloto desligado.
 */
export async function dispararCopilotoMudancaEtapa(leadId: string): Promise<void> {
  try {
    if (!(await copilotoLigado())) return;
    await gerarSugestoesParaLead(leadId, "MUDANCA_ETAPA");
  } catch (e) {
    console.error("[copiloto] gatilho de mudança de etapa falhou:", e);
  }
}

export interface ResultadoCronCopiloto {
  executou: boolean;
  motivoParada: string | null;
  conversasAvaliadas: number;
  analisesGeradas: number;
}

/**
 * Gatilho QUIETUDE (doc 27): conversa quieta ~N min após o último inbound do lead sem
 * decisão nova. Idempotente por (lead, ancoraInbound): o MESMO inbound não gera duas
 * análises, mesmo com o tick rodando a cada 5 min.
 */
export async function rodarCopilotoQuietude(agora: Date = new Date()): Promise<ResultadoCronCopiloto> {
  const config = await prisma.configComercial.findUnique({ where: { id: "comercial" } });
  if (!config?.copilotoAtivo) {
    return { executou: false, motivoParada: "copiloto_desligado", conversasAvaliadas: 0, analisesGeradas: 0 };
  }
  const quietudeMs = (config.copilotoQuietudeMinutos ?? 10) * 60_000;
  const limiteQuieto = new Date(agora.getTime() - quietudeMs);
  // Janela superior de 48h: quietude é "acabou de esfriar", não varredura de histórico.
  const limiteAntigo = new Date(agora.getTime() - 48 * 3600_000);

  const conversas = await prisma.conversaWhatsApp.findMany({
    where: {
      ultimoInboundEm: { not: null, lte: limiteQuieto, gte: limiteAntigo },
      contato: { leadId: { not: null } },
    },
    select: { ultimoInboundEm: true, contato: { select: { leadId: true } } },
  });

  let analisesGeradas = 0;
  for (const conversa of conversas) {
    const leadId = conversa.contato.leadId!;
    const ancora = conversa.ultimoInboundEm!;
    const jaAnalisado = await prisma.sugestaoIA.count({
      where: { leadId, ancoraInbound: ancora },
    });
    if (jaAnalisado > 0) continue;
    const r = await gerarSugestoesParaLead(leadId, "QUIETUDE", { ancoraInbound: ancora });
    if (r.geradas > 0) analisesGeradas += 1;
    else if (r.motivo === "nada_a_sugerir" || r.motivo === "sem_conversa") {
      // Marca a âncora como analisada mesmo sem sugestão — sem isso o tick re-analisa
      // (e re-paga o modelo) a cada 5 min até o próximo inbound.
      await prisma.sugestaoIA.create({
        data: {
          leadId,
          loteId: randomUUID(),
          tipo: "RESUMO",
          status: "EXPIRADA",
          gatilho: "QUIETUDE",
          payload: {},
          justificativa: "Análise sem sugestões (registro de idempotência).",
          modelo: driverIA().nome,
          ancoraInbound: ancora,
          decididaEm: agora,
        },
      });
    }
  }

  return { executou: true, motivoParada: null, conversasAvaliadas: conversas.length, analisesGeradas };
}
