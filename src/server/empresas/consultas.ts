import { Papel, StatusCobranca, TipoCobranca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { numero, numeroOuNull, exigirSessaoComPapel } from "@/server/_shared";
import { EMPRESAS_POR_PAGINA, whereFiltrosEmpresas, type FiltrosEmpresas } from "./filtros";

// B2B — consultas (Fase 2, doc 03): lista de empresas, ficha (colaboradores + faturas) e
// o RELATÓRIO POR COLABORADOR (status da matrícula + mensalidades pagas/abertas/atrasadas).

export interface EmpresaResumo {
  id: string;
  codigo: string | null;
  nome: string;
  pais: string | null;
  ativo: boolean;
  colaboradores: number;
  /** Faturas FECHADAS: emitidas e aguardando pagamento (StatusFaturaB2B). */
  faturasAReceber: number;
}

export async function listarEmpresas(): Promise<EmpresaResumo[]> {
  await exigirSessaoComPapel(Papel.FINANCEIRO);
  return resumirEmpresas(await prisma.empresa.findMany({
    orderBy: { criadoEm: "desc" },
    include: {
      _count: { select: { matriculas: true, faturas: { where: { status: "FECHADA" } } } },
    },
  }));
}

/** Lista de /empresas (E4): uma página com os filtros da URL, o total filtrado e o total geral. */
export async function listarEmpresasPagina(filtros: FiltrosEmpresas) {
  await exigirSessaoComPapel(Papel.FINANCEIRO);
  const where = whereFiltrosEmpresas(filtros);
  const [empresas, total, totalBase] = await Promise.all([
    prisma.empresa.findMany({
      where,
      // id como desempate: empresas criadas no mesmo instante não trocam de página entre consultas.
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      skip: (filtros.pagina - 1) * EMPRESAS_POR_PAGINA,
      take: EMPRESAS_POR_PAGINA,
      include: {
        _count: { select: { matriculas: true, faturas: { where: { status: "FECHADA" } } } },
      },
    }),
    prisma.empresa.count({ where }),
    prisma.empresa.count(),
  ]);
  return { itens: await resumirEmpresas(empresas), total, totalBase };
}

async function resumirEmpresas(empresas: (Awaited<ReturnType<typeof prisma.empresa.findMany>>[number] & { _count: { matriculas: number; faturas: number } })[]): Promise<EmpresaResumo[]> {
  const paisIds = [...new Set(empresas.map((e) => e.paisId).filter((id): id is string => !!id))];
  const paises = paisIds.length ? await prisma.pais.findMany({ where: { id: { in: paisIds } }, select: { id: true, nome: true } }) : [];
  const nomePais = new Map(paises.map((p) => [p.id, p.nome]));
  return empresas.map((e) => ({
    id: e.id,
    codigo: e.codigo,
    nome: e.nome,
    pais: e.paisId ? nomePais.get(e.paisId) ?? null : null,
    ativo: e.ativo,
    colaboradores: e._count.matriculas,
    faturasAReceber: e._count.faturas,
  }));
}

export interface ColaboradorRelatorio {
  alunoId: string;
  matriculaId: string;
  codigo: string | null;
  nome: string;
  statusMatricula: string;
  mensalidadesPagas: number;
  mensalidadesAbertas: number;
  mensalidadesAtrasadas: number;
  totalPago: number;
  moeda: string;
}

export interface FaturaResumo {
  id: string;
  codigo: string | null;
  competencia: string;
  moeda: string;
  valorTotal: number;
  status: string;
  vencimento: string;
  pagoEm: string | null;
  cobrancas: number;
}

export async function obterEmpresa(id: string) {
  await exigirSessaoComPapel(Papel.FINANCEIRO);
  const empresa = await prisma.empresa.findUnique({
    where: { id },
    include: {
      matriculas: {
        include: {
          aluno: { select: { id: true, primeiroNome: true, sobrenome: true } },
          cobrancas: { where: { tipo: TipoCobranca.MENSALIDADE } },
        },
        orderBy: { criadoEm: "desc" },
      },
      faturas: { orderBy: { competencia: "desc" }, include: { _count: { select: { cobrancas: true } } } },
    },
  });
  if (!empresa) return null;

  // RELATÓRIO POR COLABORADOR (doc 03 §B2B).
  const agora = new Date();
  const colaboradores: ColaboradorRelatorio[] = empresa.matriculas.map((m) => {
    const pagas = m.cobrancas.filter((c) => c.status === StatusCobranca.PAGO);
    const abertas = m.cobrancas.filter(
      (c) => c.status === StatusCobranca.PENDENTE || c.status === StatusCobranca.ATRASADO,
    );
    const atrasadas = abertas.filter((c) => c.vencimento < agora);
    return {
      alunoId: m.aluno.id,
      matriculaId: m.id,
      codigo: m.codigo,
      nome: [m.aluno.primeiroNome, m.aluno.sobrenome].filter(Boolean).join(" "),
      statusMatricula: m.status,
      mensalidadesPagas: pagas.length,
      mensalidadesAbertas: abertas.length,
      mensalidadesAtrasadas: atrasadas.length,
      totalPago: pagas.reduce((s, c) => s + (numeroOuNull(c.valorRecebido) ?? numero(c.valorNegociado)), 0),
      moeda: m.moeda,
    };
  });

  const faturas: FaturaResumo[] = empresa.faturas.map((f) => ({
    id: f.id,
    codigo: f.codigo,
    competencia: f.competencia,
    moeda: f.moeda,
    valorTotal: numero(f.valorTotal),
    status: f.status,
    vencimento: f.vencimento.toISOString(),
    pagoEm: f.pagoEm?.toISOString() ?? null,
    cobrancas: f._count.cobrancas,
  }));

  return {
    empresa: {
      id: empresa.id,
      codigo: empresa.codigo,
      nome: empresa.nome,
      paisId: empresa.paisId,
      documento: empresa.documento,
      contatoNome: empresa.contatoNome,
      contatoEmail: empresa.contatoEmail,
      contatoTelefone: empresa.contatoTelefone,
      diaVencimento: empresa.diaVencimento,
      observacoes: empresa.observacoes,
      ativo: empresa.ativo,
    },
    colaboradores,
    faturas,
  };
}

/** Competências com mensalidades ABERTAS fora de fatura (candidatas ao fechamento). */
export async function competenciasFaturaveis(empresaId: string): Promise<string[]> {
  await exigirSessaoComPapel(Papel.FINANCEIRO);
  const grupos = await prisma.cobranca.groupBy({
    by: ["competencia"],
    where: {
      matricula: { empresaId },
      tipo: TipoCobranca.MENSALIDADE,
      status: { in: [StatusCobranca.PENDENTE, StatusCobranca.ATRASADO] },
      faturaB2BId: null,
      competencia: { not: null },
    },
  });
  return grupos
    .map((g) => g.competencia!)
    .filter(Boolean)
    .sort();
}
