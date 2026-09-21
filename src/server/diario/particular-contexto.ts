import type { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { carregarSituacoesNaAula } from "./historico-contratual";
import { nomeCompleto } from "@/lib/nome";

/** Lê somente a pessoa e o histórico do contrato vinculado ao encontro. */
export async function carregarAlunoParticularTx(tx: Prisma.TransactionClient, matriculaId: string, inicio: Date) {
  const m = await tx.matricula.findUnique({ where: { id: matriculaId }, select: { alunoId: true, aluno: { select: { primeiroNome: true, sobrenome: true } } } });
  if (!m) throw new ErroRegra("Matrícula do encontro não encontrada.");
  const situacao = (await carregarSituacoesNaAula(tx, [matriculaId], inicio)).get(matriculaId);
  return { exigeConferencia: !situacao || situacao === "A_CONFERIR", alunos: situacao === "ATIVA" ? [{ alunoId: m.alunoId, nomeAluno: nomeCompleto(m.aluno) }] : [] };
}
