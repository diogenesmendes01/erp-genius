import type { Prisma } from "@prisma/client";
import type { carregarImpactosAcademicosEncerramentoTx } from "./encerramento-impactos-academicos";

/** Cancelamento segue sua aprovação pedagógica; o acerto não presume aula não realizada. */
export async function conferirAgendaEncerramentoTx(tx: Prisma.TransactionClient,
  impactos: Awaited<ReturnType<typeof carregarImpactosAcademicosEncerramentoTx>>,
  dataEfetiva: string, fuso: string, incluiDia: boolean,
) {
  const [r] = await tx.$queryRaw<{ limite: Date }[]>`SELECT ((${dataEfetiva}::date + ${incluiDia ? 1 : 0}::integer)::timestamp AT TIME ZONE ${fuso}) AT TIME ZONE 'UTC' AS limite`;
  const encontros = impactos.encontrosParticulares.filter(e => e.status !== "CANCELADO" && e.status !== "RASCUNHO" && new Date(e.fim) > r.limite);
  const recuperacoes = (impactos.encontrosRecuperacao ?? []).filter(e => e.status === "PREVISTO" && new Date(e.fim) > r.limite);
  // Legados sem preparação comercial também podem ter condições por hora aprovadas.
  const porHora = impactos.regimeCobranca === "HORA_PARTICULAR" || (impactos.regimeCobranca === null &&
    await tx.condicoesHorasMatricula.count({ where: { matriculaId: impactos.matriculaId, status: "APROVADA" } }) > 0);
  const candidatos = porHora ? impactos.encontrosParticulares.filter(e => e.status !== "RASCUNHO" &&
    (e.status === "CANCELADO" || new Date(e.fim) <= r.limite) && !e.reservasHoras.length) : [];
  const conferencias = candidatos.length ? await tx.conferenciaOcorrenciaHoras.findMany({ where: {
    encontroId: { in: candidatos.map(e => e.id) }, encontro: { matriculaId: impactos.matriculaId } },
    select: { id: true, encontroId: true, desfecho: true, valor: true, itemFaturado: { select: { id: true, emissao: { select: { cobrancaId: true, cobranca: { select: { matriculaId: true } } } } } } } }) : [];
  const destinacoes = candidatos.flatMap<{ encontroId: string; conferenciaId: string; tipo: "FATURADA" | "SEM_COBRANCA"; cobrancaId: string | null; itemId: string | null }>(e => {
    const c = conferencias.find(c => c.encontroId === e.id);
    if (!c) return [];
    if (c.itemFaturado?.emissao.cobranca.matriculaId === impactos.matriculaId) return [{ encontroId: e.id, conferenciaId: c.id,
      tipo: "FATURADA" as const, cobrancaId: c.itemFaturado.emissao.cobrancaId, itemId: c.itemFaturado.id }];
    if (c.valor.isZero() && ["CANCELAMENTO_ESCOLA", "CANCELAMENTO_NO_PRAZO"].includes(c.desfecho)) return [{ encontroId: e.id,
      conferenciaId: c.id, tipo: "SEM_COBRANCA" as const, cobrancaId: null, itemId: null }];
    return [];
  });
  const semApuracao = candidatos.filter(e => !destinacoes.some(d => d.encontroId === e.id));
  return { limiteVinculo: r.limite.toISOString(), encontrosARegularizar: encontros.map(e => e.id), destinacoesHoras: destinacoes,
    ...(recuperacoes.length ? { recuperacoesARegularizar: recuperacoes.map(e => e.id) } : {}),
    pendencias: [...recuperacoes.map(e => `Recuperação ${e.id} ultrapassa o limite contratual: conferir cancelamento ou autorização acadêmica específica, sem cobrança ou consumo de oportunidade presumidos.`), ...semApuracao.map(e => `Encontro ${e.id} por hora sem destinação financeira comprovada: confira a apuração antes do encerramento.`), ...encontros.map(e => e.status === "MINISTRADO"
      ? `Encontro ${e.id} ministrado após o limite contratual: confira a data efetiva e os registros, sem apagar a aula.`
      : `Encontro ${e.id} ultrapassa o limite contratual: regularize a agenda pelo fluxo pedagógico antes de efetivar.`)],
  };
}
