import { TipoCobranca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { numero } from "@/server/_shared/decimal";
import type { UsuarioSessao } from "@/server/_shared";
import { escopoLeads } from "@/server/comercial/consultas";

// Dados para pré-preencher a tela de Nova matrícula.

/**
 * Lead para pré-preencher a tela de Nova matrícula, respeitando a visibilidade
 * row-level (doc 07): Vendedor só enxerga os próprios; Gerente Comercial/Admin
 * enxergam tudo. Fora do escopo → retorna null (a tela trata como "sem lead").
 */
export async function obterLeadParaMatricula(id: string, usuario: UsuarioSessao) {
  return prisma.lead.findFirst({
    where: { id, ...escopoLeads(usuario) },
    select: {
      id: true,
      nome: true,
      telefoneE164: true,
      paisId: true,
      segmento: true,
      vendedorDonoId: true,
      matricula: { select: { id: true } },
    },
  });
}

/** Produtos do catálogo (idioma × modalidade) para seleção. */
export async function listarProdutosParaMatricula() {
  return prisma.produto.findMany({
    orderBy: [{ idioma: { nome: "asc" } }, { modalidade: { nome: "asc" } }],
    include: { idioma: true, modalidade: true },
  });
}

/**
 * Turmas ACEITANDO MATRÍCULA = data de início no FUTURO (ainda não começaram) — doc 09.
 * Depois que a turma inicia, sai automaticamente desta lista (sem cron: é por data).
 * A vaga é calculada na UI; a contagem considera só alocações ATIVAS (issues #1/#19).
 */
export async function listarTurmasAbertas() {
  return prisma.turma.findMany({
    where: { dataInicio: { gt: new Date() } },
    orderBy: { dataInicio: "asc" },
    include: {
      modalidade: true,
      nivel: { include: { idioma: true } },
      // Conta SOMENTE alocações ativas (issues #1/#19) — vaga calculada na UI (histórico inativo não ocupa vaga).
      _count: { select: { alocacoes: { where: { ativa: true } } } },
    },
  });
}

/** Preços ativos (para sugerir referência → negociado). */
export async function listarPrecosAtivos() {
  // A regra garante no máximo 1 ativo por combinação; mais recente primeiro
  // (`criadoEm` desc, `id` desempata) mantém a escolha determinística.
  const precos = await prisma.precoReferencia.findMany({
    where: { ativo: true },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    select: { paisId: true, produtoId: true, tipoCobranca: true, valor: true, moeda: true },
  });
  // valor: Decimal → number (borda Server → Client)
  return precos.map((p) => ({ ...p, valor: numero(p.valor) }));
}

export type { TipoCobranca };


/**
 * C4 (auto-alocação híbrida): última turma SUGERIDA (evento `TurmaSugerida`) para as
 * matrículas do aluno, se a turma ainda existe e ainda tem vaga. O consultor confirma
 * na ficha do aluno — o sistema nunca aloca sozinho.
 */
export async function turmaSugeridaParaAluno(
  alunoId: string,
): Promise<{ turmaId: string; label: string; diasHorario: string | null } | null> {
  const matriculas = await prisma.matricula.findMany({ where: { alunoId }, select: { id: true } });
  if (matriculas.length === 0) return null;
  const evento = await prisma.evento.findFirst({
    where: { agregadoTipo: "Matricula", agregadoId: { in: matriculas.map((m) => m.id) }, tipo: "TurmaSugerida" },
    orderBy: { criadoEm: "desc" },
  });
  const turmaId = (evento?.payload as { turmaId?: string } | null)?.turmaId;
  if (!turmaId) return null;
  const turma = await prisma.turma.findUnique({
    where: { id: turmaId },
    include: {
      modalidade: true,
      nivel: { include: { idioma: true } },
      _count: { select: { alocacoes: { where: { ativa: true } } } },
    },
  });
  if (!turma || turma._count.alocacoes >= turma.capacidade) return null;
  return {
    turmaId: turma.id,
    label: `${turma.modalidade.nome} · ${turma.nivel.idioma.nome} ${turma.nivel.codigo}${turma.nome ? ` (${turma.nome})` : ""}`,
    diasHorario: turma.diasHorario,
  };
}
