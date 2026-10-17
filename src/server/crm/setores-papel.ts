import { Papel, type FinalidadeAtendimentoWhatsApp } from "@prisma/client";

// Módulo puro (sem sessão nem banco): pode ser importado por componentes cliente.
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

/**
 * Setores de atendimento do usuário, derivados do papel, em ordem canônica e sem repetição.
 * É a capacidade do CRM e a fonte única do mapeamento papel → setor. O inbox parte daqui e
 * acrescenta duas extensões explícitas em `setoresVisiveisNoInbox` (`@/server/whatsapp/setor`):
 * PROFESSOR → PEDAGOGICO e, pela Q1 (`SECRETARIA_VE_FIN_PEDAG`), a Secretaria também em
 * FINANCEIRO e PEDAGOGICO. Não acrescentar essas extensões aqui.
 */
export function setoresDoUsuario(papeis: Papel[]): FinalidadeAtendimentoWhatsApp[] {
  const s = new Set(papeis.flatMap((p) => SETOR_POR_PAPEL[p] ?? []));
  return ORDEM.filter((x) => s.has(x));
}
