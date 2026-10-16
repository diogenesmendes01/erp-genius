import { Papel, type FinalidadeAtendimentoWhatsApp } from "@prisma/client";
import { setoresDoUsuario as setoresCrmDoUsuario } from "@/server/crm/setores-papel";

/** Setor de atendimento = finalidade do atendimento (doc 02 E3.2). */
export type Setor = FinalidadeAtendimentoWhatsApp;

export const SETORES: readonly Setor[] = ["COMERCIAL", "FINANCEIRO", "SECRETARIA", "PEDAGOGICO"];

/**
 * Ponto único da Q1 (plano 03-fase-inbox, Tarefa 1; doc 02, "Conflito a decidir antes de E5").
 * true = no INBOX a SECRETARIA_ACADEMICA mantém também FINANCEIRO e PEDAGOGICO (comportamento
 * atual de escopo.ts). Se o produto decidir "só SECRETARIA", trocar para false e ajustar o teste.
 * Não afeta a capacidade do CRM (`setoresDoUsuario` de `@/server/crm/setores-papel`).
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

/** Ordem fixa de saída: SECRETARIA primeiro, depois a ordem de SETORES. */
const ORDEM_SAIDA: readonly Setor[] = ["SECRETARIA", ...SETORES.filter((s) => s !== "SECRETARIA")];

/**
 * Setores que o usuário enxerga no INBOX (plano 03-fase-inbox, Tarefa 1). Regra distinta da
 * capacidade do CRM: a base (papel → setor) vem de uma fonte só, `setoresDoUsuario` em
 * `@/server/crm/setores-papel` (reexportado por `@/server/crm/permissoes`), e aqui entram só
 * as duas extensões do inbox, explícitas:
 * - PROFESSOR → PEDAGOGICO (no CRM o professor não tem setor; no inbox o PEDAGOGICO dele é só a
 *   turma, e a Tarefa 13 não lhe dá ramo de fila);
 * - SECRETARIA_ACADEMICA → também FINANCEIRO e PEDAGOGICO enquanto `SECRETARIA_VE_FIN_PEDAG`
 *   (Q1); no CRM a Secretaria tem só SECRETARIA.
 * União sem repetição, em ordem fixa (independe da ordem dos papéis); administrador na ordem de SETORES.
 */
export function setoresVisiveisNoInbox(papeis: Papel[]): Setor[] {
  if (papeis.includes(Papel.ADMINISTRADOR)) return [...SETORES];
  const uniao = new Set<Setor>(setoresCrmDoUsuario(papeis));
  if (papeis.includes(Papel.PROFESSOR)) uniao.add("PEDAGOGICO");
  if (SECRETARIA_VE_FIN_PEDAG && papeis.includes(Papel.SECRETARIA_ACADEMICA)) {
    uniao.add("FINANCEIRO");
    uniao.add("PEDAGOGICO");
  }
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

