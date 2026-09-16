import { prisma } from "@/lib/prisma";

/** Cada informe guarda seu próprio prazo; editar a configuração não estende os anteriores. */
export async function suspensoesPorConferencia(ids: string[], agora: Date = new Date()): Promise<Map<string, Date>> {
  if (!ids.length) return new Map();
  const informes = await prisma.pagamentoInformado.groupBy({ by: ["cobrancaId"], where: {
    cobrancaId: { in: ids }, status: "A_CONFERIR", suspenderLembretesAte: { gt: agora },
  }, _max: { suspenderLembretesAte: true } });
  return new Map(informes.flatMap((i) => i._max.suspenderLembretesAte ? [[i.cobrancaId, i._max.suspenderLembretesAte] as const] : []));
}

export async function suspensaoPorConferencia(id: string, agora: Date = new Date()) {
  return (await suspensoesPorConferencia([id], agora)).get(id) ?? null;
}
