import { Papel } from "@prisma/client";

// Rótulos legíveis dos papéis (ver docs/07; ALUNO = portal — Fase 3).
export const PAPEL_LABEL: Record<Papel, string> = {
  ADMINISTRADOR: "Administrador",
  GERENTE_COMERCIAL: "Gerente Comercial",
  VENDEDOR: "Vendedor",
  GERENTE_PEDAGOGICO: "Gerente Pedagógico",
  PROFESSOR: "Professor",
  FINANCEIRO: "Financeiro",
  SECRETARIA_ACADEMICA: "Secretaria Acadêmica",
  ALUNO: "Aluno (portal)",
};

export function temPapel(papeis: string[] = [], ...alvo: Papel[]): boolean {
  return papeis.some((p) => alvo.includes(p as Papel));
}

export function isAdmin(papeis: string[] = []): boolean {
  return papeis.includes(Papel.ADMINISTRADOR);
}
