import { StatusCobranca, StatusTurma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Vagas de uma turma = capacidade − ocupação. `ocupacaoAtiva` deve vir de um `_count`
 * filtrado por `{ ativa: true }`: alocações inativas (aluno transferido/removido) ficam no
 * histórico mas NÃO ocupam vaga. Nunca retorna negativo.
 */
export function vagasTurma(capacidade: number, ocupacaoAtiva: number) {
  return Math.max(0, capacidade - ocupacaoAtiva);
}

// Situação financeira resumida a partir das cobranças.
function resumoFinanceiro(cobrancas: { status: StatusCobranca; vencimento: Date; valorNegociado: number }[]) {
  const agora = new Date();
  const atrasado = cobrancas.some(
    (c) => c.status === StatusCobranca.ATRASADO || (c.status === StatusCobranca.PENDENTE && c.vencimento < agora),
  );
  const emAberto = cobrancas
    .filter((c) => c.status === StatusCobranca.PENDENTE || c.status === StatusCobranca.ATRASADO)
    .reduce((s, c) => s + c.valorNegociado, 0);
  const proximo = cobrancas
    .filter((c) => c.status === StatusCobranca.PENDENTE && c.vencimento >= agora)
    .sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime())[0];
  return { atrasado, emAberto, proximoVencimento: proximo?.vencimento ?? null };
}

export async function listarAlunos() {
  const alunos = await prisma.aluno.findMany({
    orderBy: { nome: "asc" },
    include: {
      pais: { select: { nome: true } },
      alocacoes: {
        where: { ativa: true },
        take: 1,
        include: { turma: { include: { modalidade: true, nivel: true } } },
      },
      matriculas: {
        select: { cobrancas: { select: { status: true, vencimento: true, valorNegociado: true } } },
      },
    },
  });

  return alunos.map((a) => {
    const cobrancas = a.matriculas.flatMap((m) => m.cobrancas);
    const turma = a.alocacoes[0]?.turma ?? null;
    return {
      id: a.id,
      codigo: a.codigo,
      nome: a.nome,
      status: a.status,
      pais: a.pais.nome,
      criadoEm: a.criadoEm.toISOString(),
      turma: turma
        ? { id: turma.id, label: `${turma.modalidade.nome} ${turma.nivel.codigo}` }
        : null,
      financeiro: resumoFinanceiro(cobrancas),
    };
  });
}

export async function obterAluno(id: string) {
  const aluno = await prisma.aluno.findUnique({
    where: { id },
    include: {
      pais: { select: { nome: true } },
      alocacoes: {
        where: { ativa: true },
        take: 1,
        include: {
          turma: {
            include: { modalidade: true, nivel: { include: { idioma: true } }, professor: { select: { nome: true } } },
          },
        },
      },
      matriculas: {
        include: { cobrancas: true, produto: { include: { idioma: true, modalidade: true } } },
      },
      movimentacoes: { orderBy: { criadoEm: "desc" }, include: { usuario: { select: { nome: true } } } },
    },
  });
  if (!aluno) return null;
  const cobrancas = aluno.matriculas.flatMap((m) => m.cobrancas);
  return { aluno, financeiro: resumoFinanceiro(cobrancas) };
}

export async function listarTurmasAbertasComVaga() {
  const turmas = await prisma.turma.findMany({
    where: { status: StatusTurma.ABERTA },
    include: {
      modalidade: true,
      nivel: { include: { idioma: true } },
      // Vagas só consideram alocações ativas (histórico inativo não ocupa lugar).
      _count: { select: { alocacoes: { where: { ativa: true } } } },
    },
  });
  return turmas
    .filter((t) => vagasTurma(t.capacidade, t._count.alocacoes) > 0)
    .map((t) => ({
      id: t.id,
      label: `${t.modalidade.nome} · ${t.nivel.idioma.nome} ${t.nivel.codigo} · ${t.diasHorario ?? "a definir"} · ${vagasTurma(
        t.capacidade,
        t._count.alocacoes,
      )} vagas`,
    }));
}

export async function obterTurma(id: string) {
  return prisma.turma.findUnique({
    where: { id },
    include: {
      modalidade: true,
      nivel: { include: { idioma: true } },
      professor: { select: { nome: true } },
      alocacoes: { where: { ativa: true }, include: { aluno: { select: { id: true, nome: true, codigo: true, status: true } } } },
    },
  });
}
