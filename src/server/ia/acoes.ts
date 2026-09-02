"use server";

import { revalidatePath } from "next/cache";
import { EtapaLead, Papel, Segmento, Temperatura, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ErroPermissao,
  ErroRegra,
  executarAcao,
  exigirPapel,
  exigirSessao,
  registrarEvento,
  transicaoManualPermitida,
  type Resultado,
  type UsuarioSessao,
} from "@/server/_shared";
import { gerarSugestoesParaLead, copilotoLigado } from "./copiloto";
import type { ResumoExecutivo } from "./tipos";

// AÇÕES do copiloto (C3, doc 27): a IA sugere; SÓ um humano aplica. Aceitar/corrigir passa
// pelas MESMAS regras das telas (máquina de funil, visibilidade row-level, evento em toda
// mutação) — a sugestão nunca é um segundo caminho de escrita no CRM (doc 29 regra 7).

const PAPEIS_COMERCIAL: Papel[] = [Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL, Papel.VENDEDOR];

/** Visibilidade row-level do vendedor — mesmo escopo das telas do CRM (doc 07). */
async function exigirLeadVisivel(leadId: string, usuario: UsuarioSessao) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new ErroRegra("Lead não encontrado.");
  const amplo =
    usuario.papeis.includes(Papel.ADMINISTRADOR) || usuario.papeis.includes(Papel.GERENTE_COMERCIAL);
  if (!amplo && lead.vendedorDonoId !== usuario.id) {
    throw new ErroPermissao("Este lead não está na sua carteira.");
  }
  return lead;
}

function revalidar(leadId: string) {
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/inbox");
  revalidatePath("/pipeline");
}

/** Sob demanda ("Gerar sugestões" na ficha/inbox). Exige o copiloto LIGADO na config. */
export async function gerarSugestoesLead(leadId: string): Promise<Resultado<{ geradas: number }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(leadId, autor);
    if (!(await copilotoLigado())) {
      throw new ErroRegra("O copiloto está desligado — ative-o em Configuração → WhatsApp → Comercial.");
    }
    const r = await gerarSugestoesParaLead(leadId, "SOB_DEMANDA");
    revalidar(leadId);
    if (r.geradas === 0 && r.motivo === "driver_falhou") {
      throw new ErroRegra("A análise falhou — tente novamente em instantes.");
    }
    return { geradas: r.geradas };
  });
}

interface Aplicacao {
  data: Record<string, unknown>;
  evento: { tipo: string; payload: Record<string, unknown> };
}

/**
 * Traduz UMA sugestão em mutação do lead — reaproveitando as regras das ações manuais.
 * `valores` (na correção) substitui o payload sugerido.
 */
function montarAplicacao(
  tipo: string,
  payload: Record<string, unknown>,
  leadEtapa: EtapaLead,
): Aplicacao {
  if (tipo === "RESUMO") {
    const r = (payload.resumo ?? {}) as Partial<ResumoExecutivo>;
    const campos = {
      interesse: r.interesse ?? null,
      objetivo: r.objetivo ?? null,
      urgencia: r.urgencia ?? null,
      orcamento: r.orcamento ?? null,
      objecao: r.objecao ?? null,
      proximaAcao: r.proximaAcao ?? null,
    };
    // Aplicação PARCIAL: campo null na sugestão não apaga o que o vendedor já escreveu.
    const data = Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== null));
    if (Object.keys(data).length === 0) throw new ErroRegra("A sugestão de resumo está vazia.");
    return { data, evento: { tipo: "ResumoAtualizado", payload: { ...data, via: "copiloto" } } };
  }
  if (tipo === "TEMPERATURA") {
    const t = payload.temperatura;
    if (typeof t !== "string" || !(t in Temperatura)) throw new ErroRegra("Temperatura sugerida inválida.");
    return {
      data: { temperatura: t as Temperatura },
      evento: { tipo: "TemperaturaAlterada", payload: { para: t, via: "copiloto" } },
    };
  }
  if (tipo === "SEGMENTO") {
    const s = payload.segmento;
    if (typeof s !== "string" || !(s in Segmento)) throw new ErroRegra("Segmento sugerido inválido.");
    return {
      data: { segmento: s as Segmento },
      evento: { tipo: "LeadEditado", payload: { segmento: s, via: "copiloto" } },
    };
  }
  if (tipo === "ETAPA") {
    const e = payload.etapa;
    if (typeof e !== "string" || !(e in EtapaLead)) throw new ErroRegra("Etapa sugerida inválida.");
    const destino = e as EtapaLead;
    // MESMA máquina de estados do moverEtapa — revalidada AGORA (a etapa pode ter mudado
    // entre a geração da sugestão e a decisão humana).
    if (destino === leadEtapa) throw new ErroRegra("O lead já está nesta etapa.");
    if (!transicaoManualPermitida(leadEtapa, destino)) {
      throw new ErroRegra(`A sugestão envelheceu: mover de "${leadEtapa}" para "${destino}" não é mais válido.`);
    }
    return {
      data: { etapa: destino },
      evento: { tipo: "EtapaAlterada", payload: { de: leadEtapa, para: destino, origem: "copiloto" } },
    };
  }
  throw new ErroRegra(`Tipo de sugestão desconhecido: ${tipo}.`);
}

async function decidirSugestao(
  sugestaoId: string,
  decisao: "ACEITA" | "CORRIGIDA" | "DESCARTADA",
  valoresCorrigidos: Record<string, unknown> | null,
): Promise<{ leadId: string }> {
  const autor = await exigirSessao();
  exigirPapel(autor, ...PAPEIS_COMERCIAL);

  const sugestao = await prisma.sugestaoIA.findUnique({ where: { id: sugestaoId } });
  if (!sugestao) throw new ErroRegra("Sugestão não encontrada.");
  if (sugestao.status !== "PENDENTE") throw new ErroRegra("Esta sugestão já foi decidida.");
  const lead = await exigirLeadVisivel(sugestao.leadId, autor);

  await prisma.$transaction(async (tx) => {
    if (decisao !== "DESCARTADA") {
      const payload = valoresCorrigidos ?? (sugestao.payload as Record<string, unknown>);
      const aplicacao = montarAplicacao(sugestao.tipo, payload, lead.etapa);
      await tx.lead.update({ where: { id: lead.id }, data: aplicacao.data });
      await registrarEvento(tx, {
        tipo: aplicacao.evento.tipo,
        agregadoTipo: "Lead",
        agregadoId: lead.id,
        autorId: autor.id, // quem DECIDIU — a IA nunca é autora de mutação
        payload: { ...aplicacao.evento.payload, sugestaoId: sugestao.id },
      });
    }
    await tx.sugestaoIA.update({
      where: { id: sugestao.id },
      data: {
        status: decisao,
        decididaEm: new Date(),
        decididaPorId: autor.id,
        ...(valoresCorrigidos ? { payload: valoresCorrigidos as Prisma.InputJsonValue } : {}),
      },
    });
    // Métrica-gate (doc 27): a decisão é o dado — evento auditável por tipo.
    await registrarEvento(tx, {
      tipo: "SugestaoIADecidida",
      agregadoTipo: "Lead",
      agregadoId: lead.id,
      autorId: autor.id,
      payload: { sugestaoId: sugestao.id, tipo: sugestao.tipo, decisao },
    });
  });

  return { leadId: lead.id };
}

export async function aceitarSugestao(sugestaoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const { leadId } = await decidirSugestao(sugestaoId, "ACEITA", null);
    revalidar(leadId);
  });
}

/** Aceita com edição — os valores corrigidos substituem o payload (conta como CORRIGIDA). */
export async function corrigirSugestao(
  sugestaoId: string,
  valores: Record<string, unknown>,
): Promise<Resultado> {
  return executarAcao(async () => {
    const { leadId } = await decidirSugestao(sugestaoId, "CORRIGIDA", valores);
    revalidar(leadId);
  });
}

export async function descartarSugestao(sugestaoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const { leadId } = await decidirSugestao(sugestaoId, "DESCARTADA", null);
    revalidar(leadId);
  });
}
