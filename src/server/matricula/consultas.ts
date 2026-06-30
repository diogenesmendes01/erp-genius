import { TipoCobranca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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
  return prisma.precoReferencia.findMany({
    where: { ativo: true },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    select: { paisId: true, produtoId: true, tipoCobranca: true, valor: true, moeda: true },
  });
}

export type { TipoCobranca };
