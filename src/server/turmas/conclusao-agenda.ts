import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";

/** A decisão usa a meta aprovada da turma, nunca uma edição posterior do catálogo. */
export async function conferirConclusaoTurma(tx: Prisma.TransactionClient, turmaId: string) {
  const proposta = await tx.propostaGradeTurma.findFirst({ where: { turmaId, decisao: { aprovada: true } }, orderBy: { versao: "desc" }, select: { id: true, snapshot: true } });
  const meta = z.object({ origem: z.object({ quantidadeAulas: z.number().int().positive() }) }).safeParse(proposta?.snapshot);
  if (!proposta || !meta.success) throw new ErroRegra("A conclusão exige meta de aulas aprovada. Confira a agenda e o histórico da turma.");
  const encontros = await tx.encontroAgenda.findMany({ where: { turmaId, finalidade: "AULA", status: { not: "RASCUNHO" } }, select: {
    id: true, status: true, fim: true, diario: { select: { conteudo: true, registros: { select: { presente: true } } } },
  } });
  if (encontros.some((e) => e.status === "PREVISTO")) throw new ErroRegra("Há encontros previstos pendentes. Resolva as aulas antes de concluir a turma.");
  const ministrados = encontros.filter((e) => e.status === "MINISTRADO");
  if (ministrados.length < meta.data.origem.quantidadeAulas) throw new ErroRegra("A quantidade exigida de aulas ministradas ainda não foi cumprida.");
  if (ministrados.some((e) => e.fim > new Date() || !e.diario?.conteudo.trim() || !e.diario.registros.length || e.diario.registros.some((r) => r.presente === null)))
    throw new ErroRegra("Há diário incompleto ou encontro inconsistente. Regularize antes de concluir a turma.");
  return { propostaGradeId: proposta.id, quantidadeExigida: meta.data.origem.quantidadeAulas, encontrosMinistrados: ministrados.map((e) => e.id).sort() };
}
