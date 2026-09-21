import { Papel, TipoCobranca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { numero } from "@/server/_shared/decimal";
import { exigirSessaoComPapel, type UsuarioSessao } from "@/server/_shared";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";

// Dados para pré-preencher a tela de Nova matrícula.

/**
 * Lead para pré-preencher a tela de Nova matrícula, respeitando a visibilidade
 * row-level (doc 07): Vendedor só enxerga os próprios; Gerente Comercial/Admin
 * enxergam tudo. Fora do escopo → retorna null (a tela trata como "sem lead").
 */
export async function obterLeadParaMatricula(id: string, usuario: UsuarioSessao) {
  const atual = await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);
  if (atual.id !== usuario.id) return null;
  const escopo = atual.papeis.includes(Papel.SECRETARIA_ACADEMICA) ? {} : await escopoComercialAtual(atual);
  return prisma.lead.findFirst({
    where: { AND: [{ id }, escopo] },
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
  await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);
  return prisma.produto.findMany({
    orderBy: [{ idioma: { nome: "asc" } }, { modalidade: { nome: "asc" } }],
    include: { idioma: true, modalidade: true },
  });
}

/**
 * Turmas ACEITANDO MATRÍCULA = data de início no FUTURO (ainda não começaram) — doc 09.
 * Depois que a turma inicia, sai automaticamente desta lista (sem cron: é por data).
 * A vaga é calculada na UI; a contagem considera alocações ativas e reservas ocupantes.
 */
export async function listarTurmasAbertas() {
  await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);
  return prisma.turma.findMany({
    where: { status: "ABERTA", dataInicio: { gt: new Date() } },
    orderBy: { dataInicio: "asc" },
    include: {
      modalidade: true,
      nivel: { include: { idioma: true } },
      // Alocações ativas e reservas ocupantes são descontadas da capacidade na UI.
      _count: { select: { alocacoes: { where: { ativa: true } }, reservasMatricula: { where: { status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } } } } },
    },
  });
}

/** Preços ativos (para sugerir referência → negociado). */
export async function listarPrecosAtivos() {
  await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);
  // A regra garante no máximo 1 ativo por combinação; mais recente primeiro
  // (`criadoEm` desc, `id` desempata) mantém a escolha determinística.
  const precos = await prisma.precoReferencia.findMany({
    where: { ativo: true, pais: { status: "ATIVO" } },
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
