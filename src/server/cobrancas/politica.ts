import type { Prisma } from "@prisma/client";
import type { EstadoPolitica, ModoDegrau } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MODELOS_WHATSAPP, type ModeloWhatsapp } from "@/server/financeiro/schema";
import { MODOS_FABRICA, POLITICA_COBRANCA_NOME } from "./fabrica";
import { REGUA, type DegrauRegua, type PassoRegua, type TipoAcao } from "./regua";

export { MODOS_FABRICA, POLITICA_COBRANCA_NOME };

export interface PoliticaCarregada {
  id: string | null;
  nome: string;
  estado: EstadoPolitica;
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
    estado: "DESLIGADA",
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

export async function carregarPoliticaRegua(db: Pick<Prisma.TransactionClient, "politicaRegua"> = prisma): Promise<PoliticaCarregada> {
  const p = await db.politicaRegua.findFirst({
    where: { escopo: "COBRANCA" },
    include: { degraus: { include: { template: true }, orderBy: { offsetDias: "asc" } } },
    orderBy: { criadoEm: "asc" },
  });
  if (!p) return politicaDeFabrica();

  const { degraus, modoPorPasso, templateIdPorPasso } = traduzirDegrausPolitica(
    p.degraus.map((d) => ({ passo: d.passo, offsetDias: d.offsetDias, tipo: d.tipo, rotulo: d.rotulo, modo: d.modo, ativo: d.ativo, templateId: d.templateId, templateNome: d.template?.nome ?? null })),
  );

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

export interface LinhaDegrauPolitica {
  passo: string;
  offsetDias: number;
  tipo: string;
  rotulo: string;
  modo: ModoDegrau;
  ativo: boolean;
  templateId: string | null;
  templateNome: string | null;
}

export function traduzirDegrausPolitica(linhas: readonly LinhaDegrauPolitica[]): Pick<PoliticaCarregada, "degraus" | "modoPorPasso" | "templateIdPorPasso"> {
  const degraus: DegrauRegua[] = [];
  const modoPorPasso = new Map<PassoRegua, ModoDegrau>();
  const templateIdPorPasso = new Map<PassoRegua, string | null>();
  const emOrdem = [...linhas].sort((a: LinhaDegrauPolitica, b: LinhaDegrauPolitica) => a.offsetDias - b.offsetDias);
  for (const d of emOrdem) {
    if (!d.ativo) continue;
    const passo = PASSOS.find((x) => x === d.passo);
    const tipo = passo === "D+15" ? "cobrar" : TIPOS.find((x) => x === d.tipo);
    if (!passo || !tipo) continue;
    const template = MODELOS_WHATSAPP.find((m) => m === d.templateNome) ?? modeloFabrica(passo);
    degraus.push({ passo, offsetDias: d.offsetDias, tipo, template, rotulo: passo === "D+15" ? "Cobrança final" : d.rotulo });
    modoPorPasso.set(passo, (passo === "D+15" || tipo === "bloquear") && d.modo === "AUTOMATICO" ? "MANUAL" : d.modo);
    templateIdPorPasso.set(passo, d.templateId ?? null);
  }
  return { degraus, modoPorPasso, templateIdPorPasso };
}

function modeloFabrica(passo: PassoRegua): ModeloWhatsapp {
  return REGUA.find((d) => d.passo === passo)?.template ?? "dados";
}
