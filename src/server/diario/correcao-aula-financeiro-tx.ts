import type { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";

/** Chamador autoriza a gestão e mantém o lock institucional. Não retorna valores. */
export async function carregarDependenciasFinanceirasAulaTx(tx: Prisma.TransactionClient, encontroId: string, matriculaIds: string[]) {
  const [ocorrencias, reservas] = await Promise.all([
    tx.ocorrenciaParticular.findMany({ where: { encontroId }, orderBy: [{ versao: "asc" }, { id: "asc" }],
      select: { id: true, matriculaId: true, versao: true, tipo: true, conferenciaFinanceira: {
        select: { id: true, itemFaturado: { select: { id: true, emissaoId: true } } } } } }),
    tx.reservaHorasCompradas.findMany({ where: { encontroId }, orderBy: { id: "asc" },
      select: { id: true, compra: { select: { matriculaId: true } }, consumo: { select: { id: true } },
        decisoesLiberacao: { where: { aprovada: true }, orderBy: { id: "asc" }, select: { id: true } } } }),
  ]);
  const escopo = new Set(matriculaIds);
  if (ocorrencias.some(o => !escopo.has(o.matriculaId)) || reservas.some(r => !escopo.has(r.compra.matriculaId))) {
    throw new ErroRegra("Os vínculos financeiros da aula não correspondem às matrículas da chamada. Solicite conferência.");
  }
  return {
    exigeConferenciaFinanceira: ocorrencias.length > 0 || reservas.length > 0,
    ocorrencias: ocorrencias.map(o => ({ id: o.id, matriculaId: o.matriculaId, versao: o.versao, tipo: o.tipo,
      conferenciaId: o.conferenciaFinanceira?.id ?? null, itemFaturadoId: o.conferenciaFinanceira?.itemFaturado?.id ?? null,
      emissaoId: o.conferenciaFinanceira?.itemFaturado?.emissaoId ?? null })),
    reservas: reservas.map(r => ({ id: r.id, matriculaId: r.compra.matriculaId, consumoId: r.consumo?.id ?? null,
      liberacoesAprovadas: r.decisoesLiberacao.map(d => d.id) })),
  };
}
