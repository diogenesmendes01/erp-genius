import { Papel, Prisma, StatusCobranca, TipoCobranca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { numero, numeroOuNull, exigirSessaoComPapel } from "@/server/_shared";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { EMPRESAS_POR_PAGINA, orderByEmpresas, whereFiltrosEmpresas, type FiltrosEmpresas } from "./filtros";
import { vencimentoEmAtraso } from "@/server/operacao/fuso";
import { fusoDaEscola } from "@/server/relatorios/atendimento";

export interface EmpresaResumo {
  id: string;
  codigo: string | null;
  nome: string;
  pais: string | null;
  ativo: boolean;
  colaboradores: number;
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

function papeisDe(usuario: { papeis?: Papel[] }) {
  return usuario.papeis ?? [];
}

function visaoIrrestrita(usuario: { papeis?: Papel[] }) {
  const papeis = papeisDe(usuario);
  return papeis.includes(Papel.ADMINISTRADOR) || papeis.includes(Papel.FINANCEIRO) || papeis.includes(Papel.SECRETARIA_ACADEMICA);
}

function podeVerFaturasB2B(usuario: { papeis?: Papel[] }) {
  const papeis = papeisDe(usuario);
  return papeis.includes(Papel.ADMINISTRADOR) || papeis.includes(Papel.FINANCEIRO);
}

async function whereEmpresasVisiveis(usuario: UsuarioSessao): Promise<Prisma.EmpresaWhereInput> {
  if (visaoIrrestrita(usuario)) return {};
  const papeis = papeisDe(usuario);
  if (!papeis.includes(Papel.VENDEDOR) && !papeis.includes(Papel.GERENTE_COMERCIAL)) return { id: "__sem_acesso__" };
  const escopo = await escopoComercialAtual(usuario);
  return {
    OR: [
      { oportunidades: { some: escopo } },
      { pessoas: { some: { oportunidades: { some: escopo } } } },
      { matriculas: { some: { lead: { is: escopo } } } },
    ],
  };
}

function combinarEmpresa(filtro: Prisma.EmpresaWhereInput, escopo: Prisma.EmpresaWhereInput): Prisma.EmpresaWhereInput {
  const temEscopo = Object.keys(escopo).length > 0;
  const temFiltro = Object.keys(filtro).length > 0;
  if (temEscopo && temFiltro) return { AND: [filtro, escopo] };
  return temEscopo ? escopo : filtro;
}

export async function listarEmpresasPagina(filtros: FiltrosEmpresas) {
  const usuario = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL, Papel.VENDEDOR);
  const escopo = await whereEmpresasVisiveis(usuario);
  const where = combinarEmpresa(whereFiltrosEmpresas(filtros), escopo);
  const [empresas, total, totalBase] = await Promise.all([
    prisma.empresa.findMany({
      where,
      orderBy: orderByEmpresas(filtros.ordem),
      skip: (filtros.pagina - 1) * EMPRESAS_POR_PAGINA,
      take: EMPRESAS_POR_PAGINA,
      include: {
        _count: { select: { matriculas: true, faturas: { where: { status: "FECHADA" } } } },
      },
    }),
    prisma.empresa.count({ where }),
    Object.keys(escopo).length ? prisma.empresa.count({ where: escopo }) : prisma.empresa.count(),
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
  const usuario = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL, Papel.VENDEDOR);
  const escopo = await whereEmpresasVisiveis(usuario);
  const comercial = !visaoIrrestrita(usuario);
  const escopoLead = comercial ? await escopoComercialAtual(usuario) : null;
  const empresa = await prisma.empresa.findFirst({
    where: { id, ...escopo },
    include: {
      matriculas: {
        ...(escopoLead ? { where: { lead: { is: escopoLead } } } : {}),
        include: {
          aluno: { select: { id: true, primeiroNome: true, sobrenome: true } },
          cobrancas: { where: { tipo: TipoCobranca.MENSALIDADE } },
        },
        orderBy: { criadoEm: "desc" },
      },
      faturas: {
        ...(podeVerFaturasB2B(usuario) ? {} : { where: { id: { in: [] } } }),
        orderBy: { competencia: "desc" },
        include: { _count: { select: { cobrancas: true } } },
      },
    },
  });
  if (!empresa) return null;

  const agora = new Date(), fuso = await fusoDaEscola();
  const colaboradores: ColaboradorRelatorio[] = empresa.matriculas.map((m) => {
    const pagas = m.cobrancas.filter((c) => c.status === StatusCobranca.PAGO);
    const abertas = m.cobrancas.filter(
      (c) => c.status === StatusCobranca.PENDENTE || c.status === StatusCobranca.ATRASADO,
    );
    const atrasadas = abertas.filter((c) => vencimentoEmAtraso(c.vencimento, agora, fuso));
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
