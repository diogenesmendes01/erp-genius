import { Papel, type FinalidadeAtendimentoWhatsApp } from "@prisma/client";
import { setoresDoUsuario as setoresCrmDoUsuario } from "@/server/crm/setores-papel";

export type Setor = FinalidadeAtendimentoWhatsApp;

export const SETORES: readonly Setor[] = ["COMERCIAL", "FINANCEIRO", "SECRETARIA", "PEDAGOGICO"];

export const SECRETARIA_VE_FIN_PEDAG = true;

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

const ORDEM_SAIDA: readonly Setor[] = ["SECRETARIA", ...SETORES.filter((s) => s !== "SECRETARIA")];

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

export function papeisDoSetor(setor: Setor): Papel[] {
  return [...PAPEIS_POR_SETOR[setor]];
}

export function papeisDeTriagem(setores: readonly Setor[]): Papel[] {
  return [...new Set(SETORES.filter((s) => setores.includes(s)).flatMap((s) => PAPEIS_POR_SETOR[s]))].filter((p) => p !== Papel.PROFESSOR);
}

export function podeTriarSetores(papeis: readonly Papel[], setores: readonly Setor[]): boolean {
  const aceitos = papeisDeTriagem(setores);
  return papeis.some((p) => aceitos.includes(p));
}
