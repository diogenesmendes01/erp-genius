import type { Prisma } from "@prisma/client";

export const MATRICULAS_POR_PAGINA = 40;

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

