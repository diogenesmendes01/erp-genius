import { Prisma } from "@prisma/client";
import { isDeepStrictEqual } from "node:util";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { dataCivilInstitucional } from "@/server/operacao/fuso";
import { carregarPreviaPausaTx, PAPEIS_PAUSA } from "./pausa-estado";
import { APROVADORES_PAUSA, estadoHashPausa, exigirUsuarioPausa, hashPausa } from "./pausa-integridade";

/** Núcleo transacional usado pela aplicação contratual autorizada.
 * A data de operação é civil institucional e deve vir do relógio do servidor, nunca do formulário.
 */
export async function aplicarPausaMatriculasTx(tx: Prisma.TransactionClient, propostaId: string, autorId: string, agora: Date) {
  await tx.$queryRaw`SELECT id FROM "PropostaPausaMatriculas" WHERE id = ${propostaId} FOR UPDATE`;
  const p = await tx.propostaPausaMatriculas.findUnique({ where: { id: propostaId }, include: { itens: { orderBy: { matriculaId: "asc" } } } });
  if (!p) throw new ErroRegra("Proposta não encontrada.");
  await exigirUsuarioPausa(tx, autorId, PAPEIS_PAUSA);
  if (p.status === "APLICADA") return { propostaId: p.id, status: p.status };
  if (p.status !== "APROVADA" || !p.decisorId || p.decisorId === p.solicitanteId)
    throw new ErroRegra("A pausa exige proposta aprovada por outra pessoa.");
  const dataEfetiva = p.dataEfetiva.toISOString().slice(0, 10);
  const ids = p.itens.map((i) => i.matriculaId);
  if (ids.length === 0) throw new ErroRegra("Proposta sem matrículas selecionadas.");
  const previa = await carregarPreviaPausaTx(tx, p.alunoId, { matriculaIds: ids, dataEfetiva }, autorId);
  await tx.$queryRaw`SELECT id FROM "Aluno" WHERE id = ${p.alunoId} FOR SHARE`;
  const aluno = await tx.aluno.findUnique({ where: { id: p.alunoId }, select: { status: true } });
  if (aluno?.status !== "ATIVO") throw new ErroRegra("O cadastro possui uma situação global que exige conferência antes da pausa contratual.");
  if (!previa.fusoInstitucional) throw new ErroRegra("Configure o fuso institucional antes de aplicar a pausa.");
  const hoje = dataCivilInstitucional(agora, previa.fusoInstitucional);
  if (dataEfetiva > hoje) throw new ErroRegra("A data efetiva da pausa ainda não chegou.");
  await exigirUsuarioPausa(tx, p.solicitanteId, PAPEIS_PAUSA);
  await exigirUsuarioPausa(tx, p.decisorId, APROVADORES_PAUSA);
  if (hashPausa({ alunoId: p.alunoId, ids, motivo: p.motivo, dataEfetiva }) !== p.entradaHash || await estadoHashPausa(tx, ids) !== p.estadoHash || !isDeepStrictEqual(p.snapshot, previa))
    throw new ErroRegra("Os impactos mudaram após a conferência. A pausa exige nova proposta e aprovação.");
  if (previa.matriculas.some((m) => m.pendencias.length > 0)) throw new ErroRegra("Há pendências que impedem executar a pausa.");

  for (const m of previa.matriculas) {
    const item = p.itens.find((i) => i.matriculaId === m.matriculaId)!;
    const suspensas = m.periodos.filter((c) => c.efeito === "SUSPENDER_PERIODO_FUTURO").map((c) => c.cobrancaId);
    // Suspender cobertura quitada preserva PAGO e seus recebimentos.
    await tx.cobranca.updateMany({ where: { id: { in: suspensas }, matriculaId: m.matriculaId, status: "PAGO" }, data: {
      suspensaPorItemPausaId: item.id, versao: { increment: 1 },
    } });
    await tx.cobranca.updateMany({ where: { id: { in: suspensas }, matriculaId: m.matriculaId, status: { not: "PAGO" } }, data: {
      status: "CANCELADA", suspensaPorItemPausaId: item.id, versao: { increment: 1 },
    } });
    await tx.matricula.update({ where: { id: m.matriculaId }, data: { status: "PAUSADA", acessoVersao: { increment: 1 } } });
    await tx.movimentacaoAluno.create({ data: { alunoId: p.alunoId, matriculaId: m.matriculaId, tipo: "PAUSA", motivo: p.motivo,
      observacao: `Pausa contratual aprovada: ${p.id}. Data efetiva: ${dataEfetiva}.`, usuarioId: autorId, criadoEm: agora } });
    await registrarEvento(tx, { agregadoTipo: "Matricula", agregadoId: m.matriculaId, tipo: "MatriculaPausada", autorId,
      payload: { propostaId: p.id, itemId: item.id, dataEfetiva, motivo: p.motivo, cobrancasSuspensas: suspensas } });
  }
  await tx.propostaPausaMatriculas.update({ where: { id: p.id }, data: { status: "APLICADA", aplicadaEm: agora } });
  return { propostaId: p.id, status: "APLICADA" as const };
}
