import { Papel, Prisma, StatusCobranca, StatusAprovacao } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared";

// Papéis com visão GLOBAL da ficha financeira (doc 07): operam o financeiro de
// QUALQUER aluno. Vendedor NÃO está aqui — vê só a ficha de alunos ligados a ele.
const PAPEIS_AMPLO_FICHA: Papel[] = [
  Papel.ADMINISTRADOR,
  Papel.FINANCEIRO,
  Papel.SECRETARIA_ACADEMICA,
  Papel.GERENTE_PEDAGOGICO,
  Papel.GERENTE_COMERCIAL,
];

function temVisaoAmplaFicha(usuario: UsuarioSessao): boolean {
  return usuario.papeis.some((p) => PAPEIS_AMPLO_FICHA.includes(p));
}

/**
 * Escopo row-level da ficha financeira (doc 07). Papéis amplos veem qualquer
 * aluno. Vendedor só vê a ficha de alunos ligados a ele: matrícula cuja comissão
 * é dele OU cujo lead de origem tem ele como dono. Sem usuário → sem restrição
 * (compat. com chamadas internas). Combine no `where` da consulta para que o
 * acesso fora do escopo retorne `null` (nunca dados de terceiros).
 */
export function escopoFichaFinanceira(usuario?: UsuarioSessao): Prisma.AlunoWhereInput {
  if (!usuario || temVisaoAmplaFicha(usuario)) return {};
  return {
    matriculas: {
      some: {
        OR: [
          { comissoes: { some: { vendedorId: usuario.id } } },
          { lead: { vendedorDonoId: usuario.id } },
        ],
      },
    },
  };
}

/**
 * Uma matrícula "pertence" ao vendedor quando ele tem comissão nela OU é o dono
 * do lead de origem (mesma regra de `escopoFichaFinanceira`). Usado para filtrar,
 * row-level, as matrículas retornadas na ficha — para não vazar matrículas (e suas
 * cobranças/ajustes/comissões) de OUTROS vendedores no mesmo aluno.
 */
function matriculaDoVendedor(
  matricula: {
    comissoes: { vendedorId: string }[];
    lead: { vendedorDonoId: string | null } | null;
  },
  vendedorId: string,
): boolean {
  return (
    matricula.comissoes.some((c) => c.vendedorId === vendedorId) ||
    matricula.lead?.vendedorDonoId === vendedorId
  );
}

export async function obterFichaFinanceira(alunoId: string, usuario?: UsuarioSessao) {
  const aluno = await prisma.aluno.findFirst({
    where: { id: alunoId, ...escopoFichaFinanceira(usuario) },
    include: {
      pais: { select: { nome: true } },
      responsaveis: { include: { responsavel: true } },
      matriculas: {
        include: {
          cobrancas: { orderBy: { vencimento: "asc" } },
          comissoes: { include: { vendedor: { select: { nome: true } } } },
          ajustes: { orderBy: { criadoEm: "desc" }, include: { autor: { select: { nome: true } } } },
          produto: { include: { idioma: true, modalidade: true } },
          lead: { select: { vendedorDonoId: true } },
        },
      },
    },
  });
  if (!aluno) return null;

  // Row-level (doc 07): papéis amplos veem a ficha completa; vendedor só vê as
  // SUAS matrículas (e as cobranças/ajustes/comissões aninhadas nelas) — nunca as
  // de outros vendedores no mesmo aluno. KPIs/somatórios abaixo derivam apenas
  // das matrículas visíveis, então não vazam totais de terceiros.
  if (usuario && !temVisaoAmplaFicha(usuario) && usuario.papeis.includes(Papel.VENDEDOR)) {
    aluno.matriculas = aluno.matriculas.filter((m) => matriculaDoVendedor(m, usuario.id));
  }

  const cobrancas = aluno.matriculas.flatMap((m) => m.cobrancas);
  const ajustes = aluno.matriculas.flatMap((m) => m.ajustes);
  const comissoes = aluno.matriculas.flatMap((m) => m.comissoes);
  const agora = new Date();

  const emAtraso = cobrancas
    .filter((c) => c.status === StatusCobranca.ATRASADO || (c.status === StatusCobranca.PENDENTE && c.vencimento < agora))
    .reduce((s, c) => s + c.valorNegociado, 0);
  const emAberto = cobrancas
    .filter((c) => c.status === StatusCobranca.PENDENTE || c.status === StatusCobranca.ATRASADO)
    .reduce((s, c) => s + c.valorNegociado, 0);
  const proximo = cobrancas
    .filter((c) => c.status === StatusCobranca.PENDENTE && c.vencimento >= agora)
    .sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime())[0] ?? null;
  const ultimoPago = cobrancas
    .filter((c) => c.status === StatusCobranca.PAGO && c.pagoEm)
    .sort((a, b) => (b.pagoEm!.getTime() ?? 0) - (a.pagoEm!.getTime() ?? 0))[0] ?? null;

  const responsavelFinanceiro =
    aluno.responsaveis.find((r) => r.papel === "FINANCEIRO")?.responsavel.nome ?? "O próprio aluno";

  return { aluno, cobrancas, ajustes, comissoes, responsavelFinanceiro, emAtraso, emAberto, proximo, ultimoPago };
}

export async function listarAprovacoesPendentes() {
  return prisma.aprovacao.findMany({
    where: { status: StatusAprovacao.PENDENTE },
    orderBy: { criadoEm: "asc" },
    include: { solicitante: { select: { nome: true } } },
  });
}
