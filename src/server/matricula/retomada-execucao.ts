import { isDeepStrictEqual } from "node:util";
import { Prisma } from "@prisma/client";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { reavaliarAcessoAutomaticoMatriculaTx } from "@/server/cobrancas/acesso-aulas";
import { dataCivilInstitucional } from "@/server/operacao/fuso";
import { PAPEIS_PAUSA } from "./pausa-estado";
import { APROVADORES_PAUSA, estadoHashPausa, exigirUsuarioPausa, hashPausa } from "./pausa-integridade";
import { carregarPreviaRetomadaTx } from "./retomada-estado";
import { PreviaRetomadaMatriculasSchema } from "./retomada-schema";

/** Núcleo da aplicação contratual. Relógio e data civil institucional vêm do servidor.
 */
export async function aplicarRetomadaMatriculasTx(tx: Prisma.TransactionClient, propostaId: string, autorId: string, agora: Date) {
  await tx.$queryRaw`SELECT id FROM "PropostaRetomadaMatriculas" WHERE id = ${propostaId} FOR UPDATE`;
  const p = await tx.propostaRetomadaMatriculas.findUnique({ where: { id: propostaId }, include: { itens: { orderBy: { matriculaId: "asc" } } } });
  if (!p) throw new ErroRegra("Proposta não encontrada.");
  await exigirUsuarioPausa(tx, autorId, PAPEIS_PAUSA);
  if (p.status === "APLICADA") return { propostaId: p.id, status: p.status };
  if (p.status !== "APROVADA" || !p.decisorId || p.decisorId === p.solicitanteId) throw new ErroRegra("A retomada exige aprovação independente.");
  const entrada = PreviaRetomadaMatriculasSchema.parse(p.entrada);
  const ids = p.itens.map((i) => i.matriculaId);
  if (hashPausa({ alunoId: p.alunoId, entrada, motivo: p.motivo }) !== p.entradaHash || hashPausa(entrada.matriculas.map((m) => m.matriculaId)) !== hashPausa(ids))
    throw new ErroRegra("A seleção ou as condições da proposta mudaram.");
  const previa = await carregarPreviaRetomadaTx(tx, p.alunoId, entrada, autorId);
  await tx.$queryRaw`SELECT id FROM "Aluno" WHERE id = ${p.alunoId} FOR SHARE`;
  const aluno = await tx.aluno.findUnique({ where: { id: p.alunoId }, select: { status: true } });
  if (aluno?.status !== "ATIVO") throw new ErroRegra("O cadastro possui uma situação global que exige conferência antes da retomada contratual.");
  if (!previa.fusoInstitucional) throw new ErroRegra("Configure o fuso institucional antes de aplicar a retomada.");
  const hoje = dataCivilInstitucional(agora, previa.fusoInstitucional);
  if (entrada.retorno > hoje) throw new ErroRegra("A data do retorno ainda não chegou.");
  await exigirUsuarioPausa(tx, p.solicitanteId, PAPEIS_PAUSA);
  await exigirUsuarioPausa(tx, p.decisorId, APROVADORES_PAUSA);
  if (await estadoHashPausa(tx, ids) !== p.estadoHash || !isDeepStrictEqual(p.snapshot, previa)) throw new ErroRegra("Os impactos mudaram após a aprovação.");
  if (previa.matriculas.some((m) => m.pendencias.length)) throw new ErroRegra("Há pendências que impedem executar a retomada.");
  for (const m of previa.matriculas) {
    const reprogramar = entrada.matriculas.find((i) => i.matriculaId === m.matriculaId)!.vencimentos.opcao === "REPROGRAMAR_PARCELAS";
    for (const periodo of m.periodos) {
      const cobranca = await tx.cobranca.findUniqueOrThrow({ where: { id: periodo.cobrancaId }, select: { status: true } });
      await tx.cobranca.update({ where: { id: periodo.cobrancaId }, data: {
        coberturaInicio: new Date(`${periodo.cobertura.inicio}T00:00:00Z`), coberturaFim: new Date(`${periodo.cobertura.fim}T00:00:00Z`),
        ...(reprogramar ? { vencimento: new Date(`${periodo.vencimento}T00:00:00Z`) } : {}),
        status: cobranca.status === "PAGO" ? "PAGO" : periodo.vencimento < hoje ? "ATRASADO" : "PENDENTE",
        suspensaPorItemPausaId: null, versao: { increment: 1 }, cicloRegua: { increment: 1 },
      } });
    }
    await tx.matricula.update({ where: { id: m.matriculaId }, data: { status: "ATIVA", acessoVersao: { increment: 1 } } });
    await reavaliarAcessoAutomaticoMatriculaTx(tx, m.matriculaId, agora);
    await tx.movimentacaoAluno.create({ data: { alunoId: p.alunoId, matriculaId: m.matriculaId, tipo: "REATIVACAO", motivo: p.motivo,
      observacao: `Retomada contratual aprovada: ${p.id}. Data de retorno: ${entrada.retorno}.`, usuarioId: autorId, criadoEm: agora } });
    await registrarEvento(tx, { agregadoTipo: "Matricula", agregadoId: m.matriculaId, tipo: "MatriculaRetomada", autorId,
      payload: { propostaId: p.id, pausaId: m.pausaId, retorno: entrada.retorno, motivo: p.motivo, periodos: m.periodos } });
  }
  await tx.propostaRetomadaMatriculas.update({ where: { id: p.id }, data: { status: "APLICADA", aplicadaEm: agora } });
  await tx.$executeRaw`SET CONSTRAINTS exigir_evento_transicao_retomada_matriculas IMMEDIATE`;
  return { propostaId: p.id, status: "APLICADA" as const };
}
