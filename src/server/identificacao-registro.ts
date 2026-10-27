import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";
import type { UsuarioSessao } from "@/server/_shared";
import { escopoAlunos } from "@/server/alunos/consultas";
import { consultarCabecalhoMatricula, type CabecalhoMatricula } from "@/server/matricula/cabecalho";

export type IdentificacaoAluno = { alunoId: string; aluno: string };

export async function consultarIdentificacaoAluno(usuario: UsuarioSessao, alunoId: string): Promise<IdentificacaoAluno | null> {
  if (!alunoId.trim()) return null;
  const aluno = await prisma.aluno.findFirst({ where: { AND: [{ id: alunoId }, escopoAlunos(usuario)] }, select: { id: true, primeiroNome: true, sobrenome: true } });
  return aluno ? { alunoId: aluno.id, aluno: nomeCompleto(aluno) } : null;
}

export type IdentificacaoReposicao = CabecalhoMatricula & { turma: string | null; aulaOrigemInicio: Date };

export async function consultarIdentificacaoReposicao(usuario: UsuarioSessao, entrada: { reposicaoId: string; matriculaId: string }): Promise<IdentificacaoReposicao | null> {
  const cabecalho = await consultarCabecalhoMatricula(usuario, entrada.matriculaId);
  if (!cabecalho || !entrada.reposicaoId.trim()) return null;
  const reposicao = await prisma.reposicaoIndividual.findFirst({
    where: { id: entrada.reposicaoId, matriculaId: cabecalho.id },
    select: { aulaOriginal: { select: { inicio: true, turma: { select: { codigo: true, nome: true } } } } },
  });
  if (!reposicao) return null;
  const turma = reposicao.aulaOriginal.turma;
  return { ...cabecalho, turma: turma ? turma.codigo ?? turma.nome ?? null : null, aulaOrigemInicio: reposicao.aulaOriginal.inicio };
}
