import { Papel, Prisma, StatusCobranca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";
import { somarPorMoeda } from "@/lib/dinheiro";
import { numero, semDecimais } from "@/server/_shared/decimal";
import type { UsuarioSessao } from "@/server/_shared";
import { docenteAtual, escopoTurmasDocente } from "@/server/diario/permissoes";
import { ALUNOS_POR_PAGINA, orderByAlunos, whereFiltrosAlunos, type FiltrosAlunos } from "./filtros";
import { rotuloTurmaAcademica } from "@/server/academico/regras";
import { carregarOfertasAgendaDestinoTx } from "@/server/academico/destino-agenda";
import {
  carregarTrilhasVencimentoCivil,
  incluirFonteVencimentoCivil,
  referenciaVencimentoCivil,
  type ReferenciaVencimentoCivil,
} from "@/server/financeiro/vencimento-civil";
import { vencimentoEmAtraso } from "@/server/operacao/fuso";
import { fusoDaEscola } from "@/server/relatorios/atendimento";

const PAPEIS_AMPLO_ALUNOS: Papel[] = [
  Papel.ADMINISTRADOR,
  Papel.SECRETARIA_ACADEMICA,
  Papel.GERENTE_PEDAGOGICO,
  Papel.FINANCEIRO,
];

function temVisaoAmpla(usuario: UsuarioSessao): boolean {
  return usuario.papeis.some((p) => PAPEIS_AMPLO_ALUNOS.includes(p));
}

const PAPEIS_MOVIMENTACAO_ALUNO: Papel[] = [Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO];

export function podeVerFinanceiroAluno(usuario?: UsuarioSessao): boolean {
  return !!usuario?.papeis.some((p) => p === Papel.ADMINISTRADOR || p === Papel.SECRETARIA_ACADEMICA || p === Papel.FINANCEIRO);
}

export function podeEditarCadastroAluno(usuario?: UsuarioSessao): boolean {
  return !!usuario?.papeis.some((p) => p === Papel.ADMINISTRADOR || p === Papel.SECRETARIA_ACADEMICA);
}

export function podeMovimentarAluno(usuario?: UsuarioSessao): boolean {
  if (!usuario) return false;
  if (usuario.papeis.includes(Papel.ADMINISTRADOR)) return true;
  return usuario.papeis.some((p) => PAPEIS_MOVIMENTACAO_ALUNO.includes(p));
}

export function escopoAlunos(usuario?: UsuarioSessao): Prisma.AlunoWhereInput {
  if (!usuario) return { id: { in: [] } };
  if (temVisaoAmpla(usuario)) return {};
  if (usuario.papeis.includes(Papel.PROFESSOR)) {
    return { alocacoes: { some: { ativa: true, turma: escopoTurmasDocente(usuario.id) } } };
  }
  return { id: { in: [] } };
}

function professorVeAluno(
  usuario: UsuarioSessao | undefined,
  alocacoes: { turma: Parameters<typeof docenteAtual>[1] | null }[],
): boolean {
  if (!usuario) return false;
  if (temVisaoAmpla(usuario)) return true;
  if (usuario.papeis.includes(Papel.PROFESSOR)) {
    return alocacoes.some((a) => a.turma && docenteAtual(usuario.id, a.turma));
  }
  return false;
}

export function vagasTurma(capacidade: number, ocupacaoAtiva: number) {
  return Math.max(0, capacidade - ocupacaoAtiva);
}

type CobrancaResumo = {
  status: StatusCobranca;
  vencimento: Date;
  valorNegociado: Prisma.Decimal | number;
  saldo?: Prisma.Decimal | number | null;
  valorRecebido?: Prisma.Decimal | number | null;
  moeda: string;
};

function proximaCobranca<T extends CobrancaResumo>(cobrancas: T[], agora: Date, fuso: string) {
  return cobrancas
    .filter((c) => c.status === StatusCobranca.PENDENTE && !vencimentoEmAtraso(c.vencimento, agora, fuso))
    .sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime())[0];
}

function calcularResumoFinanceiro<T extends CobrancaResumo>(cobrancas: T[], agora: Date, fuso: string) {
  const atrasado = cobrancas.some(
    (c) => c.status === StatusCobranca.ATRASADO || (c.status === StatusCobranca.PENDENTE && vencimentoEmAtraso(c.vencimento, agora, fuso)),
  );
  const emAberto = somarPorMoeda(
    cobrancas
      .filter((c) => c.status === StatusCobranca.PENDENTE || c.status === StatusCobranca.ATRASADO)
      .map((c) => ({ moeda: c.moeda, valor: Math.max(0, c.saldo != null ? numero(c.saldo) : numero(c.valorNegociado) - numero(c.valorRecebido ?? 0)) })),
  );
  const proximo = proximaCobranca(cobrancas, agora, fuso);
  return { atrasado, emAberto, proximo };
}

function resumoFinanceiro(cobrancas: CobrancaResumo[], agora: Date, fuso: string) {
  const { atrasado, emAberto, proximo } = calcularResumoFinanceiro(cobrancas, agora, fuso);
  return { atrasado, emAberto, proximoVencimento: proximo?.vencimento ?? null };
}

type CobrancaResumoDaFicha = CobrancaResumo & { id: string; matriculaId: string };

async function resumoFinanceiroDaFicha(cobrancas: CobrancaResumoDaFicha[]) {
  const { atrasado, emAberto, proximo } = calcularResumoFinanceiro(cobrancas, new Date(), await fusoDaEscola());
  const resumo = { atrasado, emAberto };
  const proxima = proximo;
  if (!proxima) return { ...resumo, proximoVencimento: null as ReferenciaVencimentoCivil | null };

  const cobranca = await prisma.cobranca.findUnique({
    where: { id: proxima.id },
    include: incluirFonteVencimentoCivil,
  });
  if (!cobranca || cobranca.matriculaId !== proxima.matriculaId) {
    return {
      ...resumo,
      proximoVencimento: {
        estado: "A_CONFERIR" as const,
        motivo: "A cobrança selecionada não está disponível no contrato esperado para conferir o vencimento.",
      },
    };
  }

  const trilhas = await carregarTrilhasVencimentoCivil(prisma, [cobranca.id], [proxima.matriculaId]);
  return {
    ...resumo,
    proximoVencimento: referenciaVencimentoCivil({
      ...cobranca,
      aplicacoesAditivoVencimento: trilhas.vencimentosPorCobranca.get(cobranca.id),
      aplicacoesM01: trilhas.m01PorCobranca.get(cobranca.id),
      retomadasReprogramadas: trilhas.retomadasReprogramadas,
    }),
  };
}

export function whereListaAlunos(usuario: UsuarioSessao, filtros?: FiltrosAlunos): Prisma.AlunoWhereInput {
  const escopo = escopoAlunos(usuario);
  if (!filtros) return escopo;
  return { AND: [escopo, whereFiltrosAlunos(filtros, temVisaoAmpla(usuario) ? undefined : escopoTurmasDocente(usuario.id))] };
}

export async function listarAlunosPagina(usuario: UsuarioSessao | undefined, filtros: FiltrosAlunos) {
  if (!usuario) return { itens: [], total: 0, totalBase: 0 };
  const [itens, total, totalBase] = await Promise.all([
    listarAlunos(usuario, filtros, { skip: (filtros.pagina - 1) * ALUNOS_POR_PAGINA, take: ALUNOS_POR_PAGINA }),
    prisma.aluno.count({ where: whereListaAlunos(usuario, filtros) }),
    prisma.aluno.count({ where: escopoAlunos(usuario) }),
  ]);
  return { itens, total, totalBase };
}

export async function opcoesFiltroAlunos(usuario?: UsuarioSessao) {
  if (!usuario) return { paises: [], turmas: [] };
  const [paises, turmas] = await Promise.all([
    prisma.pais.findMany({ where: { alunos: { some: escopoAlunos(usuario) } }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.turma.findMany({
      where: temVisaoAmpla(usuario) ? { alocacoes: { some: { ativa: true } } } : escopoTurmasDocente(usuario.id),
      orderBy: [{ modalidade: { nome: "asc" } }, { nivel: { codigo: "asc" } }, { codigo: "asc" }],
      select: { id: true, codigo: true, nome: true, modalidade: { select: { nome: true } }, nivel: { select: { codigo: true, idioma: { select: { nome: true } } } } },
    }),
  ]);
  return { paises, turmas: turmas.map((t) => ({ id: t.id, label: rotuloTurmaAcademica(t) })) };
}

export async function listarAlunos(usuario?: UsuarioSessao, filtros?: FiltrosAlunos, pagina?: { skip: number; take: number }) {
  if (!usuario) return [];
  const verFinanceiro = podeVerFinanceiroAluno(usuario);
  const alunos = await prisma.aluno.findMany({
    where: whereListaAlunos(usuario, filtros),
    orderBy: orderByAlunos(filtros?.ordem),
    ...(pagina ?? {}),
    include: {
      pais: { select: { nome: true } },
      alocacoes: {
        where: { ativa: true, ...(!temVisaoAmpla(usuario) ? { turma: escopoTurmasDocente(usuario.id) } : {}) },
        orderBy: { id: "asc" },
        include: { turma: { include: { modalidade: true, nivel: { include: { idioma: true } }, vinculosDocentes: true } } },
      },
      matriculas: {
        where: verFinanceiro ? {} : { id: { in: [] } },
        select: { cobrancas: { select: { status: true, vencimento: true, valorNegociado: true, saldo: true, valorRecebido: true, moeda: true } } },
      },
    },
  });

  const agora = new Date();
  const fuso = verFinanceiro ? await fusoDaEscola() : null;
  return alunos.map((a) => {
    const cobrancas = a.matriculas.flatMap((m) => m.cobrancas);
    const alocacoes = a.alocacoes.filter((v) => temVisaoAmpla(usuario) || docenteAtual(usuario.id, v.turma));
    return {
      id: a.id,
      codigo: a.codigo,
      nome: nomeCompleto(a),
      status: a.status,
      pais: a.pais.nome,
      criadoEm: a.criadoEm.toISOString(),
      turmas: alocacoes.map(({ turma }) => ({ id: turma.id, label: rotuloTurmaAcademica(turma) })),
      financeiro: fuso ? resumoFinanceiro(cobrancas, agora, fuso) : null,
    };
  });
}

export async function obterAluno(id: string, usuario?: UsuarioSessao) {
  if (!usuario) return null;
  const aluno = await prisma.aluno.findUnique({
    where: { id },
    include: {
      pais: { select: { nome: true } },
      alocacoes: {
        where: { ativa: true, ...(!temVisaoAmpla(usuario) ? { turma: escopoTurmasDocente(usuario.id) } : {}) },
        orderBy: { id: "asc" },
        include: {
          matricula: { select: { codigo: true, status: true } },
          turma: {
            include: { modalidade: true, nivel: { include: { idioma: true } }, professor: { select: { nome: true } }, vinculosDocentes: true },
          },
        },
      },
      matriculas: {
        include: { cobrancas: true, produto: { include: { idioma: true, modalidade: true } } },
      },
      movimentacoes: { orderBy: { criadoEm: "desc" }, include: { usuario: { select: { nome: true } }, matricula: { select: { codigo: true } } } },
    },
  });
  if (!aluno) return null;
  if (!professorVeAluno(usuario, aluno.alocacoes)) return null;
  const cadastro = podeEditarCadastroAluno(usuario);
  const financeiro = podeVerFinanceiroAluno(usuario);
  const alunoPlano = semDecimais({
    id: aluno.id, codigo: aluno.codigo, primeiroNome: aluno.primeiroNome,
    sobrenome: aluno.sobrenome, nomePreferido: aluno.nomePreferido,
    status: aluno.status, criadoEm: aluno.criadoEm, paisId: aluno.paisId, pais: aluno.pais,
    idiomaNativo: aluno.idiomaNativo, fuso: aluno.fuso,
    nascimento: cadastro ? aluno.nascimento : null,
    genero: cadastro ? aluno.genero : null,
    tipoDocumentoId: cadastro ? aluno.tipoDocumentoId : null,
    documento: cadastro ? aluno.documento : null,
    documentoValido: cadastro ? aluno.documentoValido : false,
    documentoPaisEmissor: cadastro ? aluno.documentoPaisEmissor : null,
    nacionalidade: cadastro ? aluno.nacionalidade : null,
    segundaNacionalidade: cadastro ? aluno.segundaNacionalidade : null,
    email: cadastro ? aluno.email : null,
    telefoneE164: cadastro ? aluno.telefoneE164 : null,
    whatsapp: cadastro ? aluno.whatsapp : false,
    aceitaComunicacoes: cadastro ? aluno.aceitaComunicacoes : false,
    paisResidencia: cadastro ? aluno.paisResidencia : null,
    cep: cadastro ? aluno.cep : null, rua: cadastro ? aluno.rua : null,
    numero: cadastro ? aluno.numero : null, complemento: cadastro ? aluno.complemento : null,
    bairro: cadastro ? aluno.bairro : null, cidade: cadastro ? aluno.cidade : null,
    regiao: cadastro ? aluno.regiao : null, escolaridade: cadastro ? aluno.escolaridade : null,
    observacoes: cadastro ? aluno.observacoes : null,
    alocacoes: aluno.alocacoes.filter((a) => temVisaoAmpla(usuario) || docenteAtual(usuario.id, a.turma)).map((a) => ({
      id: a.id, ativa: a.ativa, turmaId: a.turmaId, matriculaId: a.matriculaId ?? null, matricula: a.matricula ?? null,
      turma: {
        id: a.turma.id, professorId: a.turma.professorId, diasHorario: a.turma.diasHorario,
        modalidade: { nome: a.turma.modalidade.nome },
        nivel: { codigo: a.turma.nivel.codigo, idioma: { nome: a.turma.nivel.idioma.nome } },
        professor: a.turma.professor,
      },
    })),
    matriculas: financeiro ? aluno.matriculas : [],
    movimentacoes: aluno.movimentacoes.filter((m) => temVisaoAmpla(usuario) || aluno.alocacoes.some((a) => docenteAtual(usuario.id, a.turma)
      && (m.matriculaId ? m.matriculaId === a.matriculaId : m.turmaOrigemId === a.turmaId || m.turmaDestinoId === a.turmaId))).map((m) => ({
      id: m.id, tipo: m.tipo, criadoEm: m.criadoEm, usuario: m.usuario,
      matriculaId: m.matriculaId ?? null, matriculaCodigo: m.matricula?.codigo ?? null,
      motivo: cadastro ? m.motivo : null,
      observacao: cadastro ? m.observacao : null,
    })),
  });
  return {
    aluno: alunoPlano,
    financeiro: financeiro
      ? await resumoFinanceiroDaFicha(aluno.matriculas.flatMap((m) => m.cobrancas))
      : null,
  };
}

export async function listarTurmasAbertasComVaga(usuario?: UsuarioSessao) {
  if (!podeMovimentarAluno(usuario)) return [];
  const agora = new Date();
  const turmas = await prisma.turma.findMany({
    where: { status: { in: ["ABERTA", "EM_ANDAMENTO"] } },
    include: {
      modalidade: true,
      nivel: { include: { idioma: true } },
      _count: { select: { alocacoes: { where: { ativa: true } }, reservasMatricula: { where: { status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } } } } },
    },
  });
  const ofertas = await carregarOfertasAgendaDestinoTx(prisma, turmas.map((turma) => turma.id), agora);
  return turmas
    .filter((t) => ofertas.get(t.id)?.disponivel && vagasTurma(t.capacidade, (t._count.alocacoes + t._count.reservasMatricula)) > 0)
    .map((t) => ({
      id: t.id,
      label: `${t.modalidade.nome} · ${t.nivel.idioma.nome} ${t.nivel.codigo} · ${t.diasHorario ?? "a definir"} · ${vagasTurma(
        t.capacidade,
        (t._count.alocacoes + t._count.reservasMatricula),
      )} vagas`,
    }));
}

export async function obterTurma(id: string, usuario?: UsuarioSessao) {
  if (!usuario || (!temVisaoAmpla(usuario) && !usuario.papeis.includes(Papel.PROFESSOR))) return null;
  const turma = await prisma.turma.findUnique({
    where: { id },
    include: {
      modalidade: true,
      nivel: { include: { idioma: true } },
      professor: { select: { nome: true } },
      vinculosDocentes: true,
      alocacoes: { where: { ativa: true }, include: { aluno: { select: { id: true, primeiroNome: true, sobrenome: true, codigo: true, status: true } } } },
    },
  });
  if (!turma) return null;
  if (
    usuario &&
    !temVisaoAmpla(usuario) &&
    usuario.papeis.includes(Papel.PROFESSOR) &&
    !docenteAtual(usuario.id, turma)
  ) {
    return null;
  }
  return { ...turma, cronograma: null, vinculosDocentes: [] };
}
