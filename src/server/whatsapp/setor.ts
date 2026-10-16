import { Papel, type FinalidadeAtendimentoWhatsApp } from "@prisma/client";

/** Setor de atendimento = finalidade do atendimento (doc 02 E3.2). */
export type Setor = FinalidadeAtendimentoWhatsApp;

export const SETORES: readonly Setor[] = ["COMERCIAL", "FINANCEIRO", "SECRETARIA", "PEDAGOGICO"];

/**
 * Ponto único da Q1. true = a SECRETARIA_ACADEMICA mantém também FINANCEIRO e
 * PEDAGOGICO (comportamento atual de escopo.ts). Se o produto decidir "só
 * SECRETARIA", trocar para false e ajustar o teste correspondente.
 */
export const SECRETARIA_VE_FIN_PEDAG = true;

/** Papéis que pertencem nativamente a cada setor (gerentes primeiro). */
const PAPEIS_POR_SETOR: Record<Setor, Papel[]> = {
  COMERCIAL: [Papel.GERENTE_COMERCIAL, Papel.VENDEDOR],
  FINANCEIRO: [Papel.FINANCEIRO],
  SECRETARIA: [Papel.SECRETARIA_ACADEMICA],
  PEDAGOGICO: [Papel.GERENTE_PEDAGOGICO, Papel.PROFESSOR],
};

const GERENTES: Partial<Record<Setor, Papel>> = {
  COMERCIAL: Papel.GERENTE_COMERCIAL,
  PEDAGOGICO: Papel.GERENTE_PEDAGOGICO,
};

function setoresDoPapel(papel: Papel): Setor[] {
  if (papel === Papel.ADMINISTRADOR) return [...SETORES];
  if (papel === Papel.SECRETARIA_ACADEMICA) {
    return SECRETARIA_VE_FIN_PEDAG ? ["SECRETARIA", "FINANCEIRO", "PEDAGOGICO"] : ["SECRETARIA"];
  }
  return SETORES.filter((s) => PAPEIS_POR_SETOR[s].includes(papel));
}

/** Ordem fixa de saída: SECRETARIA primeiro, depois a ordem de SETORES. */
const ORDEM_SAIDA: readonly Setor[] = ["SECRETARIA", ...SETORES.filter((s) => s !== "SECRETARIA")];

/** Setores do usuário: união sem repetição, em ordem fixa (independe da ordem dos papéis). */
export function setoresDoUsuario(papeis: Papel[]): Setor[] {
  if (papeis.includes(Papel.ADMINISTRADOR)) return [...SETORES]; // teste do brief: ordem de SETORES
  const uniao = new Set<Setor>();
  for (const p of papeis) for (const s of setoresDoPapel(p)) uniao.add(s);
  return ORDEM_SAIDA.filter((s) => uniao.has(s));
}

export function ehGerenteDoSetor(papeis: Papel[], setor: Setor): boolean {
  if (papeis.includes(Papel.ADMINISTRADOR)) return true;
  const g = GERENTES[setor];
  return g !== undefined && papeis.includes(g);
}

/** Papéis nativos do setor (sem o administrador e sem a extensão da Q1). */
export function papeisDoSetor(setor: Setor): Papel[] {
  return [...PAPEIS_POR_SETOR[setor]];
}
