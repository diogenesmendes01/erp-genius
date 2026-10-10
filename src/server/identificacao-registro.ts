import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";
import type { UsuarioSessao } from "@/server/_shared";
import { escopoAlunos } from "@/server/alunos/consultas";
import { consultarCabecalhoMatricula, type CabecalhoMatricula } from "@/server/matricula/cabecalho";

// Identificação do registro nas telas de decisão fora de /matriculas/[id] (docs/43 §6 item 7): só o nome
// do aluno, o código da matrícula e o que distingue o registro — leitura, sem efeito, com o MESMO alcance das
// páginas: o aluno pelo escopo da ficha (escopoAlunos) e a matrícula pelo do cabeçalho de /matriculas/[id]
// (consultarCabecalhoMatricula). Fora do alcance (ou inexistente): null, e a tela segue sem a identificação.

export type IdentificacaoAluno = { alunoId: string; aluno: string };

export async function consultarIdentificacaoAluno(usuario: UsuarioSessao, alunoId: string): Promise<IdentificacaoAluno | null> {
  if (!alunoId.trim()) return null;
  const aluno = await prisma.aluno.findFirst({ where: { AND: [{ id: alunoId }, escopoAlunos(usuario)] }, select: { id: true, primeiroNome: true, sobrenome: true } });
  return aluno ? { alunoId: aluno.id, aluno: nomeCompleto(aluno) } : null;
}

/** Matrícula da reposição + a aula de origem (turma e início), para dizer de qual reposição se trata. */
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
