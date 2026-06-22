import { Papel, Prisma, StatusCobranca, StatusTurma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared";

// Papéis com visão GLOBAL de alunos (doc 07 / nav): veem todos os registros.
const PAPEIS_AMPLO_ALUNOS: Papel[] = [
  Papel.ADMINISTRADOR,
  Papel.SECRETARIA_ACADEMICA,
  Papel.GERENTE_PEDAGOGICO,
  Papel.FINANCEIRO,
];

function temVisaoAmpla(usuario: UsuarioSessao): boolean {
  return usuario.papeis.some((p) => PAPEIS_AMPLO_ALUNOS.includes(p));
}

// Papéis que executam movimentação acadêmica (editar/trocar/pausar/encerrar) — espelha
// `PAPEIS` em `acoes.ts`. Professor NÃO movimenta (doc 10): visão somente leitura.
const PAPEIS_MOVIMENTACAO_ALUNO: Papel[] = [Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO];

/**
 * O usuário pode ver dados financeiros do aluno (resumo + ficha financeira)?
 * Professor "puro" (sem papel amplo) tem projeção pedagógica: vê a ficha mas NADA
 * financeiro (doc 10 §2 — professor = ver turmas · ver alunos · check-in). Papéis amplos
 * (Admin/Secretaria/Pedagógico/Financeiro) mantêm a ficha completa.
 */
export function podeVerFinanceiroAluno(usuario?: UsuarioSessao): boolean {
  if (!usuario) return true;
  return temVisaoAmpla(usuario);
}

/**
 * O usuário pode executar movimentação acadêmica (editar/trocar turma/pausar/encerrar)?
 * Espelha o guard das server actions; controla apenas a exibição dos botões na UI
 * (a segurança real está nas próprias actions). Professor → somente leitura.
 */
export function podeMovimentarAluno(usuario?: UsuarioSessao): boolean {
  if (!usuario) return true;
  if (usuario.papeis.includes(Papel.ADMINISTRADOR)) return true;
  return usuario.papeis.some((p) => PAPEIS_MOVIMENTACAO_ALUNO.includes(p));
}

// Visibilidade row-level (doc 07): Professor enxerga apenas alunos das SUAS turmas;
// demais papéis amplos veem todos. Professor → restringe via alocação ativa.
export function escopoAlunos(usuario?: UsuarioSessao): Prisma.AlunoWhereInput {
  if (!usuario || temVisaoAmpla(usuario)) return {};
  if (usuario.papeis.includes(Papel.PROFESSOR)) {
    return { alocacoes: { some: { ativa: true, turma: { professorId: usuario.id } } } };
  }
  return {};
}

/** O usuário pode ver este aluno? (Professor: só se aluno está em turma sua.) */
function professorVeAluno(
  usuario: UsuarioSessao | undefined,
  alocacoes: { turma: { professorId: string | null } | null }[],
): boolean {
  if (!usuario || temVisaoAmpla(usuario)) return true;
  if (usuario.papeis.includes(Papel.PROFESSOR)) {
    return alocacoes.some((a) => a.turma?.professorId === usuario.id);
  }
  return true;
}

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

export async function listarAlunos(usuario?: UsuarioSessao) {
  const alunos = await prisma.aluno.findMany({
    where: escopoAlunos(usuario),
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

export async function obterAluno(id: string, usuario?: UsuarioSessao) {
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
  // Row-level: professor só vê a ficha de alunos das suas turmas (doc 07).
  if (!professorVeAluno(usuario, aluno.alocacoes)) return null;
  // Projeção pedagógica (doc 10): professor NÃO recebe nada financeiro — nem no payload,
  // para não vazar via rede. Papéis amplos seguem com o resumo completo.
  if (!podeVerFinanceiroAluno(usuario)) {
    return { aluno, financeiro: null };
  }
  const cobrancas = aluno.matriculas.flatMap((m) => m.cobrancas);
  return { aluno, financeiro: resumoFinanceiro(cobrancas) };
}

export async function listarTurmasAbertasComVaga() {
  const turmas = await prisma.turma.findMany({
    where: { status: StatusTurma.ABERTA },
    include: {
      modalidade: true,
      nivel: { include: { idioma: true } },
      // Conta SOMENTE alocações ativas (issues #1/#19) — histórico inativo não ocupa vaga.
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

export async function obterTurma(id: string, usuario?: UsuarioSessao) {
  const turma = await prisma.turma.findUnique({
    where: { id },
    include: {
      modalidade: true,
      nivel: { include: { idioma: true } },
      professor: { select: { nome: true } },
      alocacoes: { where: { ativa: true }, include: { aluno: { select: { id: true, nome: true, codigo: true, status: true } } } },
    },
  });
  if (!turma) return null;
  // Row-level: professor só vê turmas que leciona (doc 07).
  if (
    usuario &&
    !temVisaoAmpla(usuario) &&
    usuario.papeis.includes(Papel.PROFESSOR) &&
    turma.professorId !== usuario.id
  ) {
    return null;
  }
  return turma;
}
