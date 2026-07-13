import type { EstadoPolitica, ModoDegrau } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MODELOS_WHATSAPP, type ModeloWhatsapp } from "@/server/financeiro/schema";
import { MODOS_FABRICA, POLITICA_COBRANCA_NOME } from "./fabrica";
import { REGUA, type DegrauRegua, type PassoRegua, type TipoAcao } from "./regua";

// Política como DADO (docs 26/30): a régua deixa de ser a const REGUA e passa a ser um
// registro editável (PoliticaRegua/DegrauPolitica). Este módulo carrega o registro e o
// traduz para o formato puro que o cérebro (`proximaAcao`) consome. Sem registro no banco,
// vale a política de FÁBRICA (a própria REGUA, com os modos do doc 26 e estado DESLIGADA).
//
// LEIS (fora da config — doc 26/30): degrau `bloquear` NUNCA é AUTOMATICO (D+15 exige
// aprovação humana) — imposta aqui na leitura, mesmo que o banco diga o contrário.

export { MODOS_FABRICA, POLITICA_COBRANCA_NOME };

export interface PoliticaCarregada {
  /** null = política de fábrica (nenhum registro no banco ainda). */
  id: string | null;
  nome: string;
  estado: EstadoPolitica;
  /** Degraus ATIVOS, em ordem crescente de offset — o formato que `proximaAcao` consome. */
  degraus: readonly DegrauRegua[];
  modoPorPasso: ReadonlyMap<PassoRegua, ModoDegrau>;
  templateIdPorPasso: ReadonlyMap<PassoRegua, string | null>;
  janelaInicio: number;
  janelaFim: number;
  diasSemana: readonly number[];
  tetoPorContatoDia: number;
  silencioPosInboundHoras: number;
  killSwitch: boolean;
  numeroRemetenteId: string | null;
}

const PASSOS: readonly PassoRegua[] = ["D-7", "D-3", "D0", "D+3", "D+7", "D+15"];
const TIPOS: readonly TipoAcao[] = ["lembrar", "cobrar", "bloquear"];

export function politicaDeFabrica(): PoliticaCarregada {
  return {
    id: null,
    nome: POLITICA_COBRANCA_NOME,
    estado: "DESLIGADA", // toda automação nasce desligada (doc 27 §modelo de config)
    degraus: REGUA,
    modoPorPasso: new Map(REGUA.map((d) => [d.passo, MODOS_FABRICA[d.passo]])),
    templateIdPorPasso: new Map(REGUA.map((d) => [d.passo, null])),
    janelaInicio: 9,
    janelaFim: 20,
    diasSemana: [1, 2, 3, 4, 5],
    tetoPorContatoDia: 2,
    silencioPosInboundHoras: 72,
    killSwitch: false,
    numeroRemetenteId: null,
  };
}

/**
 * Carrega a política de cobrança do banco (ou a de fábrica, se não houver registro).
 * Linhas inválidas do banco (passo/tipo desconhecidos) são IGNORADAS com segurança — o
 * cérebro só recebe degraus bem-formados, em ordem crescente de offset.
 */
export async function carregarPoliticaRegua(): Promise<PoliticaCarregada> {
  const p = await prisma.politicaRegua.findFirst({
    where: { escopo: "COBRANCA" },
    include: { degraus: { include: { template: true }, orderBy: { offsetDias: "asc" } } },
    orderBy: { criadoEm: "asc" },
  });
  if (!p) return politicaDeFabrica();

  const degraus: DegrauRegua[] = [];
  const modoPorPasso = new Map<PassoRegua, ModoDegrau>();
  const templateIdPorPasso = new Map<PassoRegua, string | null>();
  for (const d of p.degraus) {
    if (!d.ativo) continue;
    const passo = PASSOS.find((x) => x === d.passo);
    const tipo = TIPOS.find((x) => x === d.tipo);
    if (!passo || !tipo) continue; // linha malformada nunca chega ao cérebro
    const template = MODELOS_WHATSAPP.find((m) => m === d.template?.nome) ?? modeloFabrica(passo);
    degraus.push({ passo, offsetDias: d.offsetDias, tipo, template, rotulo: d.rotulo });
    // LEI: bloquear nunca automatiza (nem por engano de config).
    modoPorPasso.set(passo, tipo === "bloquear" && d.modo === "AUTOMATICO" ? "MANUAL" : d.modo);
    templateIdPorPasso.set(passo, d.templateId ?? null);
  }

  return {
    id: p.id,
    nome: p.nome,
    estado: p.estado,
    degraus,
    modoPorPasso,
    templateIdPorPasso,
    janelaInicio: p.janelaInicio,
    janelaFim: p.janelaFim,
    diasSemana: p.diasSemana,
    tetoPorContatoDia: p.tetoPorContatoDia,
    silencioPosInboundHoras: p.silencioPosInboundHoras,
    killSwitch: p.killSwitch,
    numeroRemetenteId: p.numeroRemetenteId,
  };
}

function modeloFabrica(passo: PassoRegua): ModeloWhatsapp {
  return REGUA.find((d) => d.passo === passo)?.template ?? "dados";
}
