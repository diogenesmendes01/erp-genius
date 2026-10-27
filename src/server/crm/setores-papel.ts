import { Papel, type FinalidadeAtendimentoWhatsApp } from "@prisma/client";

const SETOR_POR_PAPEL: Record<Papel, FinalidadeAtendimentoWhatsApp[]> = {
  [Papel.ADMINISTRADOR]: ["COMERCIAL", "FINANCEIRO", "SECRETARIA", "PEDAGOGICO"],
  [Papel.GERENTE_COMERCIAL]: ["COMERCIAL"],
  [Papel.VENDEDOR]: ["COMERCIAL"],
  [Papel.FINANCEIRO]: ["FINANCEIRO"],
  [Papel.SECRETARIA_ACADEMICA]: ["SECRETARIA"],
  [Papel.GERENTE_PEDAGOGICO]: ["PEDAGOGICO"],
  [Papel.PROFESSOR]: [],
  [Papel.ALUNO]: [],
};
const ORDEM: FinalidadeAtendimentoWhatsApp[] = ["COMERCIAL", "FINANCEIRO", "SECRETARIA", "PEDAGOGICO"];

export function setoresDoUsuario(papeis: Papel[]): FinalidadeAtendimentoWhatsApp[] {
  const s = new Set(papeis.flatMap((p) => SETOR_POR_PAPEL[p] ?? []));
  return ORDEM.filter((x) => s.has(x));
}
