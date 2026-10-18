import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface PrecoAria {
  precoId: string;
  rotulo: string;
  tipoCobranca: "MATRICULA" | "MENSALIDADE";
  valor: number;
  moeda: string;
}

/** Únicos preços que a Aria pode citar: PrecoReferencia ativo do país da oportunidade, em produto oferecido. */
export async function precosDaOportunidade(oportunidadeId: string, tx?: Prisma.TransactionClient): Promise<PrecoAria[]> {
  const db = tx ?? prisma;
  const op = await db.oportunidade.findUnique({ where: { id: oportunidadeId }, select: { paisId: true } });
  if (!op?.paisId) return [];
  const precos = await db.precoReferencia.findMany({
    where: {
      paisId: op.paisId,
      ativo: true,
      tipoCobranca: { in: ["MATRICULA", "MENSALIDADE"] },
      produto: { produtosPais: { some: { paisId: op.paisId, oferecido: true } } },
    },
    include: { produto: { include: { idioma: true } }, modalidade: true },
    orderBy: [{ tipoCobranca: "asc" }, { id: "asc" }],
  });
  return precos.map((p) => ({
    precoId: p.id,
    rotulo: `${p.produto.idioma.nome} · ${p.modalidade.nome}`,
    tipoCobranca: p.tipoCobranca as "MATRICULA" | "MENSALIDADE",
    valor: Number(p.valor),
    moeda: p.moeda,
  }));
}
