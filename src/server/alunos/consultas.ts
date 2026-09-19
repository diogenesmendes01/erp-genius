import { Papel, Prisma, StatusCobranca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";
import { somarPorMoeda } from "@/lib/dinheiro";
import { numero, semDecimais } from "@/server/_shared/decimal";
import type { UsuarioSessao } from "@/server/_shared";
import { docenteAtual, escopoTurmasDocente } from "@/server/diario/permissoes";
import {
  carregarTrilhasVencimentoCivil,
  incluirFonteVencimentoCivil,
  referenciaVencimentoCivil,
  type ReferenciaVencimentoCivil,
} from "@/server/financeiro/vencimento-civil";

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
 * A amplitude de registros do pedagógico não concede campos financeiros.
 */
export function podeVerFinanceiroAluno(usuario?: UsuarioSessao): boolean {
  return !!usuario?.papeis.some((p) => p === Papel.ADMINISTRADOR || p === Papel.SECRETARIA_ACADEMICA || p === Papel.FINANCEIRO);
}

/** Cadastro administrativo é uma capacidade distinta de movimentação acadêmica. */
export function podeEditarCadastroAluno(usuario?: UsuarioSessao): boolean {
  return !!usuario?.papeis.some((p) => p === Papel.ADMINISTRADOR || p === Papel.SECRETARIA_ACADEMICA);
}

/**
 * O usuário pode executar movimentação acadêmica (editar/trocar turma/pausar/encerrar)?
 * Espelha o guard das server actions; controla apenas a exibição dos botões na UI
 * (a segurança real está nas próprias actions). Professor → somente leitura.
 */
export function podeMovimentarAluno(usuario?: UsuarioSessao): boolean {
  if (!usuario) return false;
  if (usuario.papeis.includes(Papel.ADMINISTRADOR)) return true;
  return usuario.papeis.some((p) => PAPEIS_MOVIMENTACAO_ALUNO.includes(p));
}

// Visibilidade row-level (doc 07): Professor enxerga apenas alunos das SUAS turmas;
// demais papéis amplos veem todos. Professor → restringe via alocação ativa.
// FAIL-CLOSED (review PR #48): usuário presente SEM papel amplo e SEM professor (ex.:
// papéis revogados com sessão viva) não vê NADA — nunca "todos" por omissão.
// Ausência de identidade também nega: chamada interna não é capacidade implícita.
export function escopoAlunos(usuario?: UsuarioSessao): Prisma.AlunoWhereInput {
  if (!usuario) return { id: { in: [] } };
  if (temVisaoAmpla(usuario)) return {};
  if (usuario.papeis.includes(Papel.PROFESSOR)) {
    return { alocacoes: { some: { ativa: true, turma: escopoTurmasDocente(usuario.id) } } };
  }
  return { id: { in: [] } }; // filtro impossível: sem papel adequado → lista vazia
}

/** O usuário pode ver este aluno? (Professor: só se aluno está em turma sua.)
 *  FAIL-CLOSED (review PR #48): sem papel amplo e sem professor → não vê. */
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

/**
 * Vagas de uma turma = capacidade − ocupação. `ocupacaoAtiva` deve vir de um `_count`
 * filtrado por `{ ativa: true }`: alocações inativas (aluno transferido/removido) ficam no
 * histórico mas NÃO ocupam vaga. Nunca retorna negativo.
 */
export function vagasTurma(capacidade: number, ocupacaoAtiva: number) {
  return Math.max(0, capacidade - ocupacaoAtiva);
}

// Situação financeira resumida a partir das cobranças. `emAberto` é por moeda (uma matrícula
// pode ter trocado de moeda entre anos — doc 04) e nunca soma moedas diferentes.
type CobrancaResumo = {
  status: StatusCobranca;
  vencimento: Date;
  valorNegociado: Prisma.Decimal | number;
  saldo?: Prisma.Decimal | number | null;
  valorRecebido?: Prisma.Decimal | number | null;
  moeda: string;
};

function proximaCobranca<T extends CobrancaResumo>(cobrancas: T[], agora: Date) {
  return cobrancas
    .filter((c) => c.status === StatusCobranca.PENDENTE && c.vencimento >= agora)
    .sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime())[0];
}

function calcularResumoFinanceiro<T extends CobrancaResumo>(cobrancas: T[], agora: Date) {
  const atrasado = cobrancas.some(
    (c) => c.status === StatusCobranca.ATRASADO || (c.status === StatusCobranca.PENDENTE && c.vencimento < agora),
  );
  const emAberto = somarPorMoeda(
    cobrancas
      .filter((c) => c.status === StatusCobranca.PENDENTE || c.status === StatusCobranca.ATRASADO)
      .map((c) => ({ moeda: c.moeda, valor: Math.max(0, c.saldo != null ? numero(c.saldo) : numero(c.valorNegociado) - numero(c.valorRecebido ?? 0)) })),
  );
  const proximo = proximaCobranca(cobrancas, agora);
  return { atrasado, emAberto, proximo };
}

function resumoFinanceiro(cobrancas: CobrancaResumo[]) {
  const { atrasado, emAberto, proximo } = calcularResumoFinanceiro(cobrancas, new Date());
  return { atrasado, emAberto, proximoVencimento: proximo?.vencimento ?? null };
}

type CobrancaResumoDaFicha = CobrancaResumo & { id: string; matriculaId: string };

/**
 * A coluna de vencimento é um instante, mas a data da obrigação é civil e só
 * pode ser exibida quando a emissão ou aplicação preserva a sua referência.
 * A consulta é deliberadamente restrita à cobrança que o resumo já escolheu:
 * não altera o critério de próximo vencimento, nem carrega trilhas para a
 * projeção pedagógica.
 */
async function resumoFinanceiroDaFicha(cobrancas: CobrancaResumoDaFicha[]) {
  const { atrasado, emAberto, proximo } = calcularResumoFinanceiro(cobrancas, new Date());
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

export async function listarAlunos(usuario?: UsuarioSessao) {
  if (!usuario) return [];
  const alunos = await prisma.aluno.findMany({
    where: escopoAlunos(usuario),
    orderBy: [{ primeiroNome: "asc" }, { sobrenome: "asc" }],
    include: {
      pais: { select: { nome: true } },
      alocacoes: {
        where: { ativa: true, ...(!temVisaoAmpla(usuario) ? { turma: escopoTurmasDocente(usuario.id) } : {}) },
        orderBy: { id: "asc" },
        include: { turma: { include: { modalidade: true, nivel: true, vinculosDocentes: true } } },
      },
      matriculas: {
        select: { cobrancas: { select: { status: true, vencimento: true, valorNegociado: true, saldo: true, valorRecebido: true, moeda: true } } },
      },
    },
  });

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
      turmas: alocacoes.map(({ turma }) => ({ id: turma.id, label: `${turma.modalidade.nome} ${turma.nivel.codigo}` })),
      financeiro: podeVerFinanceiroAluno(usuario) ? resumoFinanceiro(cobrancas) : null,
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
  // Row-level: professor só vê a ficha de alunos das suas turmas (doc 07).
  if (!professorVeAluno(usuario, aluno.alocacoes)) return null;
  const cadastro = podeEditarCadastroAluno(usuario);
  const financeiro = podeVerFinanceiroAluno(usuario);
  // Projeção explícita: campos novos do Prisma não são publicados automaticamente.
  // Texto livre legado não tem classificação de finalidade e fica no cadastro administrativo.
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
  // Destinos de TROCA de turma: turmas ainda não encerradas (dataFim no futuro ou ausente
  // em turmas legadas) — diferente de "aceitando matrícula" (início futuro). Um aluno pode
  // ser transferido para uma turma em andamento.
  const turmas = await prisma.turma.findMany({
    where: { status: { in: ["ABERTA", "EM_ANDAMENTO"] }, OR: [{ dataFim: null }, { dataFim: { gte: new Date() } }] },
    include: {
      modalidade: true,
      nivel: { include: { idioma: true } },
      // Conta alocações ativas e reservas ocupantes; histórico liberado não ocupa vaga.
      _count: { select: { alocacoes: { where: { ativa: true } }, reservasMatricula: { where: { status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } } } } },
    },
  });
  return turmas
    .filter((t) => vagasTurma(t.capacidade, (t._count.alocacoes + t._count.reservasMatricula)) > 0)
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
  // Row-level: professor só vê turmas que leciona (doc 07).
  if (
    usuario &&
    !temVisaoAmpla(usuario) &&
    usuario.papeis.includes(Papel.PROFESSOR) &&
    !docenteAtual(usuario.id, turma)
  ) {
    return null;
  }
  // Cronograma é texto livre legado e não faz parte da projeção de consulta da turma.
  return { ...turma, cronograma: null, vinculosDocentes: [] };
}
