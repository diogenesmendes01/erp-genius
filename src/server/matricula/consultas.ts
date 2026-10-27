import { Papel, TipoCobranca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { numero } from "@/server/_shared/decimal";
import { exigirSessaoComPapel, type UsuarioSessao } from "@/server/_shared";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";

export async function obterLeadParaMatricula(id: string, usuario: UsuarioSessao) {
  const atual = await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);
  if (atual.id !== usuario.id) return null;
  const escopo = atual.papeis.includes(Papel.SECRETARIA_ACADEMICA) ? {} : await escopoComercialAtual(atual);
  return prisma.oportunidade.findFirst({
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

export async function listarProdutosParaMatricula() {
  await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);
  return prisma.produto.findMany({
    orderBy: [{ idioma: { nome: "asc" } }, { modalidade: { nome: "asc" } }],
    include: { idioma: true, modalidade: true },
  });
}

export async function listarTurmasAbertas() {
  await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);
  return prisma.turma.findMany({
    where: { status: "ABERTA", dataInicio: { gt: new Date() } },
    orderBy: { dataInicio: "asc" },
    include: {
      modalidade: true,
      nivel: { include: { idioma: true } },
      _count: { select: { alocacoes: { where: { ativa: true } }, reservasMatricula: { where: { status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } } } } },
    },
  });
}

export async function listarPrecosAtivos() {
  await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);
  const precos = await prisma.precoReferencia.findMany({
    where: { ativo: true, pais: { status: "ATIVO" } },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    select: { paisId: true, produtoId: true, tipoCobranca: true, valor: true, moeda: true },
  });
  return precos.map((p) => ({ ...p, valor: numero(p.valor) }));
}

export type { TipoCobranca };


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
