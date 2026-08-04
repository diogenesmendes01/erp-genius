import type { EstadoPolitica } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DegrauAncora } from "@/server/cobrancas/regua";
import {
  CADENCIA_LEAD_NOVO,
  CHAVE_LEAD_NOVO,
  ORDEM_PASSOS_LEAD_NOVO,
  POLITICA_LEAD_NOVO_NOME,
} from "./regua-fabrica";

// Política COMERCIAL como DADO (doc 27 §Tese). Carrega o registro do banco e o traduz para o
// formato puro que o motor (`proximaAcaoAncora`) consome — degraus ATIVOS em ordem crescente
// de offset + a ORDEM CANÔNICA imutável (regua-fabrica) que ancora o corte de progresso.
// Sem registro no banco → política de FÁBRICA (DESLIGADA), como na cobrança.

export interface DegrauComercialCarregado extends DegrauAncora {
  rotulo: string;
  templateId: string | null;
  templateCorpo: string;
}

export interface PoliticaComercialCarregada {
  id: string | null; // null = fábrica (sem registro)
  chave: string;
  nome: string;
  estado: EstadoPolitica;
  degraus: readonly DegrauComercialCarregado[];
  /** Ordem canônica imutável de TODOS os passos da cadência (corte de progresso). */
  ordem: readonly string[];
  janelaInicio: number;
  janelaFim: number;
  diasSemana: readonly number[];
  tetoPorContatoDia: number;
  silencioPosInboundHoras: number;
  numeroRemetenteId: string | null;
}

function fabricaLeadNovo(): PoliticaComercialCarregada {
  return {
    id: null,
    chave: CHAVE_LEAD_NOVO,
    nome: POLITICA_LEAD_NOVO_NOME,
    estado: "DESLIGADA",
    degraus: CADENCIA_LEAD_NOVO.map((d) => ({
      passo: d.passo,
      offsetMinutos: d.offsetMinutos,
      rotulo: d.rotulo,
      templateId: null,
      templateCorpo: d.texto,
    })),
    ordem: ORDEM_PASSOS_LEAD_NOVO,
    janelaInicio: 9,
    janelaFim: 20,
    diasSemana: [1, 2, 3, 4, 5],
    tetoPorContatoDia: 2,
    silencioPosInboundHoras: 72,
    numeroRemetenteId: null,
  };
}

/** Ordem canônica por chave de cenário (lei de código). Só lead-novo na C1. */
const ORDEM_POR_CHAVE: Record<string, readonly string[]> = {
  [CHAVE_LEAD_NOVO]: ORDEM_PASSOS_LEAD_NOVO,
};

/** Corpo de fábrica por passo (fallback quando o degrau não tem template no banco). */
const TEXTO_FABRICA_POR_PASSO = new Map(CADENCIA_LEAD_NOVO.map((d) => [d.passo, d.texto]));

export async function carregarPoliticaComercial(
  chave: string = CHAVE_LEAD_NOVO,
): Promise<PoliticaComercialCarregada> {
  const p = await prisma.politicaComercial.findUnique({
    where: { chave },
    include: { degraus: { include: { template: true }, orderBy: { offsetMinutos: "asc" } } },
  });
  if (!p) return fabricaLeadNovo();

  const ordem = ORDEM_POR_CHAVE[chave] ?? p.degraus.map((d) => d.passo);
  const degraus: DegrauComercialCarregado[] = p.degraus
    .filter((d) => d.ativo)
    .map((d) => ({
      passo: d.passo,
      offsetMinutos: d.offsetMinutos,
      rotulo: d.rotulo,
      templateId: d.templateId,
      templateCorpo: d.template?.corpo ?? TEXTO_FABRICA_POR_PASSO.get(d.passo) ?? "",
    }));

  return {
    id: p.id,
    chave: p.chave,
    nome: p.nome,
    estado: p.estado,
    degraus,
    ordem,
    janelaInicio: p.janelaInicio,
    janelaFim: p.janelaFim,
    diasSemana: p.diasSemana,
    tetoPorContatoDia: p.tetoPorContatoDia,
    silencioPosInboundHoras: p.silencioPosInboundHoras,
    numeroRemetenteId: p.numeroRemetenteId,
  };
}
