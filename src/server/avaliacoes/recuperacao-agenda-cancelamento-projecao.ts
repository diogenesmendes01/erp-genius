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
    /** Fuso da agenda publicada vinculada ao item; não integra o snapshot. */
    fusoOrigem: string | null;
  }>;
};

/**
 * `estado_cancelamento_agenda_recuperacao` foi criado sobre TIMESTAMP sem
 * fuso. A projeção o torna explicitamente UTC apenas para a leitura, sem
 * reescrever o JSONB histórico que participa do hash da proposta.
 */
export function normalizarInstanteLegadoUtc(valor: string | null): string | null {
  if (!valor || /(?:Z|[+-]\d{2}:\d{2})$/i.test(valor)) return valor;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(valor) ? `${valor}Z` : valor;
}

/** Acrescenta referências de leitura sem alterar o snapshot nem seu hash. */
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

/**
 * Só agendas já publicadas por proposta de recuperação podem emprestar a
 * referência de fuso ao snapshot. O identificador do encontro vem do estado
 * conferido e não é substituído por outra agenda da matrícula.
 */
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
