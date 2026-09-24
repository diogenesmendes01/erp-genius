import type { Prisma } from "@prisma/client";

// Busca no histórico do diário (docs/42-auditoria-frontend-ux.md, E4): a lista só andava para trás,
// 50 aulas por vez, sem como achar uma aula por turma ou assunto. Módulo puro, testável.

type Parametros = Record<string, string | string[] | undefined>;

/** Busca da URL: até 100 caracteres, sem espaços nas pontas. */
export function lerBuscaDiario(p: Parametros): string {
  const v = p.busca;
  return (Array.isArray(v) ? v[0] : v ?? "").trim().slice(0, 100);
}

/** Cada palavra (até 6) no conteúdo da aula, no código ou nome da turma, ou no nome do professor. */
export function whereBuscaAulas(busca: string): Prisma.AulaDiarioWhereInput {
  const palavras = busca.split(/\s+/).filter(Boolean).slice(0, 6);
  if (!palavras.length) return {};
  return {
    AND: palavras.map((palavra) => {
      const contem = { contains: palavra, mode: "insensitive" as const };
      return { OR: [{ conteudo: contem }, { turma: { OR: [{ codigo: contem }, { nome: contem }] } }, { professor: { nome: contem } }] };
    }),
  };
}

/** Link do diário mantendo a busca (e o cursor, quando houver). */
export function hrefDiario({ busca, antes }: { busca?: string; antes?: string | null }): string {
  const q = new URLSearchParams();
  if (busca) q.set("busca", busca);
  if (antes) q.set("antes", antes);
  const s = q.toString();
  return s ? `/diario?${s}` : "/diario";
}
