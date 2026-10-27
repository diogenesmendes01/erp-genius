import type { Prisma } from "@prisma/client";
import { gerarCodigo } from "@/lib/codigo";
import { registrarEvento } from "@/server/_shared/evento";

export interface ReferralInbound {
  sourceType?: string | null;
  sourceId?: string | null;
  headline?: string | null;
  sourceUrl?: string | null;
  ctwaClid?: string | null;
}

export interface PessoaPorTelefone {
  alunoId: string | null;
  responsavelId: string | null;
  leadId: string | null;
}

export async function resolverPessoaPorTelefone(
  tx: Prisma.TransactionClient,
  telefoneE164: string,
): Promise<PessoaPorTelefone> {
  const [aluno, responsavel, lead] = await Promise.all([
    tx.aluno.findFirst({ where: { telefoneE164 }, select: { id: true } }),
    tx.responsavel.findFirst({ where: { telefoneE164 }, select: { id: true } }),
    tx.oportunidade.findFirst({ where: { telefoneE164 }, orderBy: { criadoEm: "desc" }, select: { id: true } }),
  ]);
  return { alunoId: aluno?.id ?? null, responsavelId: responsavel?.id ?? null, leadId: lead?.id ?? null };
}

export interface LeadDeInbound {
  telefoneE164: string;
  nomeExibicao?: string | null;
  donoId: string | null;
  paisId?: string | null;
  referral?: ReferralInbound | null;
  autorId?: string | null;
  origem?: "whatsapp_inbound" | "whatsapp_linha";
}

export async function criarLeadDeInboundWhatsApp(
  tx: Prisma.TransactionClient,
  dados: LeadDeInbound,
): Promise<string> {
  const codigo = await gerarCodigo("lead", tx);
  const lead = await tx.oportunidade.create({
    data: {
      codigo,
      nome: dados.nomeExibicao?.trim() || "Contato WhatsApp",
      telefoneE164: dados.telefoneE164,
      paisId: dados.paisId ?? null,
      vendedorDonoId: dados.donoId,
      waReferralSourceType: dados.referral?.sourceType ?? null,
      waReferralSourceId: dados.referral?.sourceId ?? null,
      waReferralHeadline: dados.referral?.headline ?? null,
      waReferralSourceUrl: dados.referral?.sourceUrl ?? null,
      waReferralCtwaClid: dados.referral?.ctwaClid ?? null,
    },
  });
  await registrarEvento(tx, {
    tipo: "LeadCriado",
    agregadoTipo: "Lead",
    agregadoId: lead.id,
    autorId: dados.autorId ?? null,
    payload: { codigo, nome: lead.nome, origem: dados.origem ?? "whatsapp_inbound", b2b: false },
  });
  if (dados.donoId) {
    await registrarEvento(tx, {
      tipo: "LeadAtribuido",
      agregadoTipo: "Lead",
      agregadoId: lead.id,
      autorId: dados.autorId ?? null,
      payload: { de: null, para: dados.donoId, via: dados.origem ?? "whatsapp_inbound" },
    });
  }
  return lead.id;
}

const KEYWORDS_CONFIRMA = new Set(["sim", "confirmo"]);
const CHAVE_PRE_EXPERIMENTAL = "PRE_EXPERIMENTAL";
const TOLERANCIA_RELOGIO_MS = 5 * 60_000;
const KEYWORDS_REAGENDA = new Set(["reagendar", "remarcar", "reagendo", "outro horario", "outro horário"]);

export type RespostaExperimental = "confirmada" | "reagendar" | null;

export function classificarRespostaExperimental(corpo: string | null): RespostaExperimental {
  if (!corpo) return null;
  const t = corpo.trim().toLowerCase();
  if (KEYWORDS_CONFIRMA.has(t)) return "confirmada";
  if (KEYWORDS_REAGENDA.has(t)) return "reagendar";
  return null;
}

export async function capturarRespostaExperimental(
  tx: Prisma.TransactionClient,
  ctx: { leadId: string | null; corpo: string | null; quando: Date },
): Promise<RespostaExperimental> {
  if (!ctx.leadId) return null;
  const resposta = classificarRespostaExperimental(ctx.corpo);
  if (!resposta) return null;

  const lead = await tx.oportunidade.findUnique({
    where: { id: ctx.leadId },
    select: { id: true, etapa: true, dataExperimental: true, experimentalConfirmadaEm: true },
  });
  if (!lead || lead.etapa !== "EXPERIMENTAL_AGENDADA" || !lead.dataExperimental) return null;

  const pedido = await tx.evento.count({
    where: {
      agregadoTipo: "Lead",
      agregadoId: lead.id,
      tipo: "ReguaComercialEnviada",
      criadoEm: { lte: new Date(ctx.quando.getTime() + TOLERANCIA_RELOGIO_MS) },
      AND: [
        { payload: { path: ["chave"], equals: CHAVE_PRE_EXPERIMENTAL } },
        { payload: { path: ["ocorrencia"], equals: lead.dataExperimental.toISOString() } },
      ],
    },
  });
  if (pedido === 0) return null;

  if (resposta === "confirmada") {
    if (lead.experimentalConfirmadaEm) return null;
    await tx.oportunidade.update({ where: { id: lead.id }, data: { experimentalConfirmadaEm: ctx.quando } });
    await registrarEvento(tx, {
      tipo: "ExperimentalConfirmada",
      agregadoTipo: "Lead",
      agregadoId: lead.id,
      autorId: null,
      payload: { via: "whatsapp_keyword" },
    });
    return "confirmada";
  }

  await tx.oportunidade.update({ where: { id: lead.id }, data: { aguardandoReagendamentoEm: ctx.quando } });
  await registrarEvento(tx, {
    tipo: "ExperimentalReagendamentoSolicitado",
    agregadoTipo: "Lead",
    agregadoId: lead.id,
    autorId: null,
    payload: { via: "whatsapp_keyword", ocorrencia: lead.dataExperimental.toISOString() },
  });
  return "reagendar";
}
