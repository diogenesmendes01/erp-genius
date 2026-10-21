import { Prisma } from "@prisma/client";
import { nomeCompleto } from "@/lib/nome";

/** Projeção mínima; chamada somente após autorização do vínculo correspondente. */
export async function identificarMatriculaAvaliacao(tx: Prisma.TransactionClient, matriculaId: string, turmaId: string) {
  const m = await tx.matricula.findUniqueOrThrow({ where: { id: matriculaId }, select: { id: true, codigo: true,
    aluno: { select: { primeiroNome: true, sobrenome: true } },
    produto: { select: { idioma: { select: { nome: true } }, modalidade: { select: { nome: true } } } } } });
  const t = await tx.turma.findUniqueOrThrow({ where: { id: turmaId }, select: { nome: true, codigo: true, nivel: { select: { codigo: true } } } });
  return { matriculaId: m.id, matriculaCodigo: m.codigo, aluno: nomeCompleto(m.aluno), oferta: `${m.produto.idioma.nome} · ${m.produto.modalidade.nome}`,
    turma: t.nome ?? t.codigo ?? "Turma sem identificação", nivel: t.nivel.codigo };
}
