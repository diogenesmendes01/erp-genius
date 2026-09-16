import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Constrói uma realização PARTICULAR persistida pela trilha Q34. É um helper
 * de integração para fontes históricas: a gratuidade excepcional continua
 * separada de cobrança e o encontro fica ligado à agenda do pedido exato.
 */
export async function criarAgendaParticularIsentaFixture(input: {
  reposicaoId: string;
  matriculaId: string;
  alunoId: string;
  professorId: string;
  secretariaId: string;
  decisorId: string;
  inicio: Date;
  fim: Date;
  encontroId?: string;
  agendaId?: string;
  autorizacaoId?: string;
  chave?: string;
  participacao?: "PRESENTE" | "FALTA";
}) {
  const encontroId = input.encontroId ?? randomUUID();
  const agendaId = input.agendaId ?? randomUUID();
  const autorizacaoId = input.autorizacaoId ?? randomUUID();
  const chave = input.chave ?? `fixture-agenda-${input.reposicaoId}`;
  const participacao = input.participacao ?? "PRESENTE";

  await prisma.$transaction(async (tx) => {
    await tx.autorizacaoExcecaoReposicaoParticular.create({ data: {
      id: autorizacaoId, reposicaoId: input.reposicaoId, solicitanteId: input.secretariaId,
      versao: 1, motivo: "Gratuidade acadêmica excepcional da reposição", evidencia: "Evidência da autorização acadêmica",
      chaveIdempotencia: `${chave}-autorizacao`, entradaHash: "fixture",
    } });
    await tx.decisaoAutorizacaoExcecaoReposicaoParticular.create({ data: {
      autorizacaoId, decisorId: input.decisorId, aprovada: true,
      motivo: "Gestão aprovou a gratuidade excepcional",
    } });
    await tx.encontroAgenda.create({ data: {
      id: encontroId, finalidade: "REPOSICAO", reposicaoIndividualId: input.reposicaoId,
      matriculaId: input.matriculaId, professorId: input.professorId, preparadorId: input.secretariaId,
      inicio: input.inicio, fim: input.fim, fusoOrigem: "UTC", status: "PREVISTO",
      motivo: "Reposição particular individual agendada", chaveIdempotencia: `${chave}-encontro`, entradaHash: "fixture",
    } });
    await tx.agendaReposicaoIndividual.create({ data: {
      id: agendaId, reposicaoId: input.reposicaoId, encontroId, autorizacaoExcecaoId: autorizacaoId,
      statusBeneficio: "ISENTA_EXCECAO", reservadoPorId: input.secretariaId,
      motivo: "Agenda isenta autorizada para o pedido específico",
    } });
  });

  // A agenda é conferida no commit com o encontro ainda PREVISTO. A realização
  // ocorre depois, quando o diário já existe e o trigger pode consumir a reserva.
  await prisma.$transaction(async (tx) => {
    await tx.aulaDiario.create({ data: {
      encontroId, professorId: input.professorId, ocorridaEm: input.inicio,
      conteudo: "Reposição particular realizada", registros: { create: {
        alunoId: input.alunoId, matriculaId: input.matriculaId, nomeAluno: "Aluno", presente: participacao === "PRESENTE", participacao,
      } },
    } });
    await tx.encontroAgenda.update({ where: { id: encontroId }, data: { status: "MINISTRADO" } });
  });

  return { agendaId, encontroId, autorizacaoId, participacao };
}
