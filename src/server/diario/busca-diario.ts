import type { Prisma } from "@prisma/client";

type Parametros = Record<string, string | string[] | undefined>;

export function lerBuscaDiario(p: Parametros): string {
  const v = p.busca;
  return (Array.isArray(v) ? v[0] : v ?? "").trim().slice(0, 100);
}

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

export function hrefDiario({ busca, antes }: { busca?: string; antes?: string | null }): string {
  const q = new URLSearchParams();
  if (busca) q.set("busca", busca);
  if (antes) q.set("antes", antes);
  const s = q.toString();
  return s ? `/diario?${s}` : "/diario";
}
