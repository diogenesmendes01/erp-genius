import type { Prisma } from "@prisma/client";

export type EstadoCancelamentoAgenda = {
  reservaId: string;
  matriculaId: string;
  cancelamentoId: string | null;
  itens: Array<{
    id: string;
    habilidade: string;
    realizacaoId: string | null;
    encontroId: string | null;
    status: string | null;
    inicio: string | null;
    fim: string | null;
    professorId: string | null;
  }>;
};

export type EstadoCancelamentoAgendaApresentacao = Omit<EstadoCancelamentoAgenda, "itens"> & {
  itens: Array<EstadoCancelamentoAgenda["itens"][number] & {
    fusoOrigem: string | null;
  }>;
};

export function normalizarInstanteLegadoUtc(valor: string | null): string | null {
  if (!valor || /(?:Z|[+-]\d{2}:\d{2})$/i.test(valor)) return valor;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(valor) ? `${valor}Z` : valor;
}

export function apresentarEstadoCancelamentoComFusos(
  estado: EstadoCancelamentoAgenda,
  fusosPorEncontro: ReadonlyMap<string, string>,
): EstadoCancelamentoAgendaApresentacao {
  return {
    ...estado,
    itens: estado.itens.map((item) => ({
      ...item,
      inicio: normalizarInstanteLegadoUtc(item.inicio),
      fim: normalizarInstanteLegadoUtc(item.fim),
      fusoOrigem: item.encontroId ? fusosPorEncontro.get(item.encontroId) ?? null : null,
    })),
  };
}

export async function carregarFusosDosEstados(
  tx: Pick<Prisma.TransactionClient, "encontroAgenda">,
  estados: readonly EstadoCancelamentoAgenda[],
): Promise<Map<string, string>> {
  const encontroIds = [...new Set(estados.flatMap((estado) => estado.itens.flatMap((item) => item.encontroId ? [item.encontroId] : [])))];
  if (!encontroIds.length) return new Map();
  const encontros = await tx.encontroAgenda.findMany({
    where: { id: { in: encontroIds }, propostaAgendaRecuperacaoId: { not: null } },
    select: { id: true, fusoOrigem: true },
  });
  return new Map(encontros.map((encontro) => [encontro.id, encontro.fusoOrigem]));
}
