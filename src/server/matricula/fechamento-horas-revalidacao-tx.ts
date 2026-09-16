import { Prisma } from "@prisma/client";
import { isDeepStrictEqual } from "node:util";
import { ErroRegra } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { PreparacaoFechamentoHorasSchema } from "./fechamento-horas-schema";
import { resolverPeriodoFechamentoHoras } from "./fechamento-horas-periodo";
import { carregarApuracaoHorasTx } from "./fechamento-horas-tx";

/** Somente uso interno por chamador autorizado. Mantém as travas até decisão/execução na mesma transação. */
export async function revalidarFechamentoHorasTx(tx: Prisma.TransactionClient, d: { alunoId: string; matriculaId: string; rascunhoId: string }) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
  await bloquearMatriculas(tx, [d.matriculaId]);
  const m = await tx.matricula.findFirst({ where: { id: d.matriculaId, alunoId: d.alunoId } });
  const r = await tx.rascunhoFechamentoHoras.findFirst({ where: { id: d.rascunhoId, matriculaId: d.matriculaId } });
  if (!m || !r) throw new ErroRegra("Fechamento não encontrado para esta matrícula e aluno.");
  const entrada = PreparacaoFechamentoHorasSchema.parse(r.entrada);
  if (entrada.alunoId !== m.alunoId || entrada.matriculaId !== m.id || entrada.documentoId !== r.documentoId || entrada.versaoAnterior + 1 !== r.versao) throw new ErroRegra("Entrada do fechamento exige conferência.");
  if (!m.contratoOk || !m.confirmacaoContratoEm || m.contratoDocumentoId !== r.documentoId) throw new ErroRegra("Contrato confirmado mudou. Prepare nova versão.");
  await tx.$queryRaw`SELECT id FROM "Documento" WHERE id=${r.documentoId} FOR SHARE`;
  if (!await tx.documento.count({ where: { id: r.documentoId, categoria: "CONTRATO", arquivado: false,
    OR: [{ matriculaId: m.id }, ...(m.leadId ? [{ leadId: m.leadId }] : [])] } })) throw new ErroRegra("Documento contratual indisponível.");
  const periodo = resolverPeriodoFechamentoHoras(entrada.periodo);
  if (r.periodoInicio.getTime() !== Date.parse(periodo.inicioInstante) || r.periodoFimExclusivo.getTime() !== Date.parse(periodo.fimExclusivo)) throw new ErroRegra("Limites do período divergentes.");
  if (await tx.rascunhoFechamentoHoras.count({ where: { matriculaId: m.id, periodoInicio: r.periodoInicio, periodoFimExclusivo: r.periodoFimExclusivo, versao: { gt: r.versao } } })) throw new ErroRegra("Confira a versão mais recente deste período.");
  const apuracao = await carregarApuracaoHorasTx(tx, { alunoId: m.alunoId, matriculaId: m.id, escolha: entrada.escolha,
    periodo: { referencia: `${periodo.inicio}/${periodo.fim}`, inicio: periodo.inicioInstante, fimExclusivo: periodo.fimExclusivo }, vencimento: periodo.vencimento });
  if (!isDeepStrictEqual(r.snapshot, { periodo, apuracao })) throw new ErroRegra("As origens da apuração mudaram. Prepare nova versão.");
  return { rascunho: r, entrada, periodo, apuracao };
}
