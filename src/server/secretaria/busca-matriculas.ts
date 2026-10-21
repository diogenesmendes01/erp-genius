import type { Prisma } from "@prisma/client";

// Busca e paginação da lista de /secretaria (docs/42-auditoria-frontend-ux.md, E4): antes eram só as
// 40 matrículas mais recentes, sem como chegar às demais. Módulo puro.

export const MATRICULAS_POR_PAGINA = 40;

/** Busca por palavras: cada uma no nome do aluno ou no código da matrícula. */
export function whereBuscaMatriculas(busca: string): Prisma.MatriculaWhereInput {
  const palavras = busca.split(/\s+/).filter(Boolean).slice(0, 6);
  if (!palavras.length) return {};
  return {
    AND: palavras.map((palavra) => {
      const contem = { contains: palavra, mode: "insensitive" as const };
      return { OR: [{ codigo: contem }, { aluno: { OR: [{ primeiroNome: contem }, { sobrenome: contem }] } }] };
    }),
  };
}

