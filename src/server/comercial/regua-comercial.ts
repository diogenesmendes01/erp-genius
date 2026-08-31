import type { EstadoPolitica } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DegrauAncora } from "@/server/cobrancas/regua";
import { CADENCIAS_COMERCIAIS, CHAVE_LEAD_NOVO } from "./regua-fabrica";

// Política COMERCIAL como DADO (doc 27 §Tese). Carrega o registro do banco e o traduz para o
// formato puro que o motor (`proximaAcaoAncora`) consome — degraus ATIVOS em ordem crescente
// de offset + a ORDEM CANÔNICA imutável (regua-fabrica) que ancora o corte de progresso.
// Sem registro no banco → política de FÁBRICA (DESLIGADA), como na cobrança.

export interface DegrauComercialCarregado extends DegrauAncora {
  rotulo: string;
  templateId: string | null;
  templateCorpo: string;
  /** B3/B4 (doc 32): tolerância máxima de atraso (min) — vira `validaAte` na intenção. */
  toleranciaMinutos: number | null;
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
  /** B1 (doc 32): cohort do piloto. Em modo piloto só a allowlist é elegível (vazia =
   *  ninguém); desligar é o go-live geral — decisão explícita, nunca default. */
  modoPiloto: boolean;
  pilotoLeadIds: readonly string[];
}

/** Cadência de fábrica por chave (lei de código: ordem canônica + textos padrão). */
type CadenciaFabrica = (typeof CADENCIAS_COMERCIAIS)[number];
const FABRICA_POR_CHAVE = new Map<string, CadenciaFabrica>(CADENCIAS_COMERCIAIS.map((c) => [c.chave, c]));

function politicaDeFabrica(chave: string): PoliticaComercialCarregada {
  const f = FABRICA_POR_CHAVE.get(chave) ?? FABRICA_POR_CHAVE.get(CHAVE_LEAD_NOVO)!;
  return {
    id: null,
    chave: f.chave,
    nome: f.nome,
    estado: "DESLIGADA",
    degraus: f.degraus.map((d) => ({
      passo: d.passo,
      offsetMinutos: d.offsetMinutos,
      rotulo: d.rotulo,
      templateId: null,
      templateCorpo: d.texto,
      toleranciaMinutos: d.toleranciaMinutos,
    })),
    ordem: f.ordem,
    janelaInicio: 9,
    janelaFim: 20,
    diasSemana: [1, 2, 3, 4, 5],
    tetoPorContatoDia: 2,
    silencioPosInboundHoras: 72,
    numeroRemetenteId: null,
    modoPiloto: true,
    pilotoLeadIds: [],
  };
}

export async function carregarPoliticaComercial(
  chave: string = CHAVE_LEAD_NOVO,
): Promise<PoliticaComercialCarregada> {
  const p = await prisma.politicaComercial.findUnique({
    where: { chave },
    include: { degraus: { include: { template: true }, orderBy: { offsetMinutos: "asc" } } },
  });
  if (!p) return politicaDeFabrica(chave);

  const fabrica = FABRICA_POR_CHAVE.get(chave);
  const ordem = fabrica?.ordem ?? p.degraus.map((d) => d.passo);
  const textoFabrica = new Map((fabrica?.degraus ?? []).map((d) => [d.passo, d.texto]));
  const toleranciaFabrica = new Map((fabrica?.degraus ?? []).map((d) => [d.passo, d.toleranciaMinutos]));
  const degraus: DegrauComercialCarregado[] = p.degraus
    .filter((d) => d.ativo)
    .map((d) => ({
      passo: d.passo,
      offsetMinutos: d.offsetMinutos,
      rotulo: d.rotulo,
      templateId: d.templateId,
      templateCorpo: d.template?.corpo ?? textoFabrica.get(d.passo) ?? "",
      // NULL no banco = "use a tolerância de fábrica" (linhas criadas antes do B3/B4).
      toleranciaMinutos: d.toleranciaMinutos ?? toleranciaFabrica.get(d.passo) ?? null,
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
    modoPiloto: p.modoPiloto,
    pilotoLeadIds: p.pilotoLeadIds,
  };
}
