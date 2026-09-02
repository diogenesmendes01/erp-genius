import { Papel, StatusCobranca, TipoCobranca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { numero, numeroOuNull, type UsuarioSessao } from "@/server/_shared";
import { nomeCompleto } from "@/lib/nome";

// ACADÊMICO — consultas (Fase 3, doc 03): diário/avaliações da turma, boletim do aluno,
// progressão SUGERIDA (o sistema calcula; um humano aprova) e o PORTAL DO ALUNO (projeção
// restrita aos próprios dados, resolvida pelo vínculo Aluno.usuarioId).

/** Critérios de aprovação da progressão (média ponderada 0–100 e frequência %). */
export const MEDIA_MINIMA = 70;
export const FREQUENCIA_MINIMA_PCT = 75;

export interface DiarioTurma {
  aulas: {
    id: string;
    dataISO: string;
    conteudo: string | null;
    presentes: number;
    total: number;
  }[];
  avaliacoes: {
    id: string;
    nome: string;
    peso: number;
    dataISO: string | null;
    notas: { alunoId: string; valor: number }[];
  }[];
  alunos: { id: string; nome: string }[];
}

export async function diarioDaTurma(turmaId: string): Promise<DiarioTurma> {
  const [aulas, avaliacoes, alocacoes] = await Promise.all([
    prisma.aula.findMany({
      where: { turmaId },
      orderBy: { data: "desc" },
      include: { _count: { select: { presencas: true } }, presencas: { where: { presente: true }, select: { id: true } } },
    }),
    prisma.avaliacao.findMany({
      where: { turmaId },
      orderBy: { criadoEm: "asc" },
      include: { notas: true },
    }),
    prisma.alocacaoTurma.findMany({
      where: { turmaId, ativa: true },
      include: { aluno: { select: { id: true, primeiroNome: true, sobrenome: true, nomePreferido: true } } },
    }),
  ]);

  return {
    aulas: aulas.map((a) => ({
      id: a.id,
      dataISO: a.data.toISOString(),
      conteudo: a.conteudo,
      presentes: a.presencas.length,
      total: a._count.presencas,
    })),
    avaliacoes: avaliacoes.map((av) => ({
      id: av.id,
      nome: av.nome,
      peso: numero(av.peso),
      dataISO: av.data?.toISOString() ?? null,
      notas: av.notas.map((n) => ({ alunoId: n.alunoId, valor: numero(n.valor) })),
    })),
    alunos: alocacoes.map((a) => ({ id: a.aluno.id, nome: nomeCompleto(a.aluno) })),
  };
}

export interface ProgressaoAluno {
  alunoId: string;
  nome: string;
  frequenciaPct: number | null; // null = sem aulas registradas
  media: number | null; // média ponderada 0–100; null = sem notas
  aprovadoSugerido: boolean;
  certificado: { codigoValidacao: string; emitidoEmISO: string } | null;
}

/**
 * PROGRESSÃO SUGERIDA da turma: frequência % + média ponderada por aluno, com o corte
 * (média ≥ 70 e frequência ≥ 75%). O sistema SUGERE; aprovar é ação humana
 * (`aprovarNivelAluno`) — filosofia híbrida (doc 08/C4).
 */
export async function progressaoDaTurma(turmaId: string): Promise<ProgressaoAluno[]> {
  const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
  if (!turma) return [];
  const [alocacoes, aulas, avaliacoes, certificados] = await Promise.all([
    prisma.alocacaoTurma.findMany({
      where: { turmaId, ativa: true },
      include: { aluno: { select: { id: true, primeiroNome: true, sobrenome: true, nomePreferido: true } } },
    }),
    prisma.aula.findMany({ where: { turmaId }, include: { presencas: true } }),
    prisma.avaliacao.findMany({ where: { turmaId }, include: { notas: true } }),
    prisma.certificado.findMany({ where: { turmaId } }),
  ]);
  const certPorAluno = new Map(certificados.map((c) => [c.alunoId, c]));

  return alocacoes.map((aloc) => {
    const alunoId = aloc.aluno.id;
    // Frequência: presenças do aluno / aulas em que ele foi chamado.
    const chamadas = aulas.flatMap((a) => a.presencas.filter((p) => p.alunoId === alunoId));
    const frequenciaPct =
      chamadas.length > 0
        ? Math.round((chamadas.filter((p) => p.presente).length / chamadas.length) * 100)
        : null;
    // Média ponderada pelas avaliações COM nota lançada para o aluno.
    let somaPesos = 0;
    let somaNotas = 0;
    for (const av of avaliacoes) {
      const nota = av.notas.find((n) => n.alunoId === alunoId);
      if (!nota) continue;
      const peso = numero(av.peso);
      somaPesos += peso;
      somaNotas += numero(nota.valor) * peso;
    }
    const media = somaPesos > 0 ? Math.round((somaNotas / somaPesos) * 10) / 10 : null;
    const cert = certPorAluno.get(alunoId) ?? null;

    return {
      alunoId,
      nome: nomeCompleto(aloc.aluno),
      frequenciaPct,
      media,
      aprovadoSugerido:
        media !== null && frequenciaPct !== null && media >= MEDIA_MINIMA && frequenciaPct >= FREQUENCIA_MINIMA_PCT,
      certificado: cert
        ? { codigoValidacao: cert.codigoValidacao, emitidoEmISO: cert.emitidoEm.toISOString() }
        : null,
    };
  });
}

// ---------------------------------------------------------------------------
// PORTAL DO ALUNO (papel ALUNO): projeção dos PRÓPRIOS dados via Aluno.usuarioId.
// ---------------------------------------------------------------------------

export interface DadosPortal {
  aluno: { id: string; nome: string; codigo: string | null };
  turma: { label: string; diasHorario: string | null; professor: string | null } | null;
  frequencia: { pct: number | null; presentes: number; total: number };
  boletim: { turma: string; avaliacao: string; nota: number | null; peso: number }[];
  media: number | null;
  financeiro: {
    id: string;
    tipo: string;
    competencia: string | null;
    valor: number;
    moeda: string;
    vencimentoISO: string;
    status: string;
    linkPagamento: string | null;
  }[];
  certificados: { nivel: string; idioma: string; codigoValidacao: string; emitidoEmISO: string }[];
  testesNivel: { nivel: string; pontuacao: number | null; dataISO: string }[];
}

/** Resolve o aluno do usuário logado no portal (null = usuário sem vínculo). */
export async function dadosPortalDoUsuario(usuario: UsuarioSessao): Promise<DadosPortal | null> {
  if (!usuario.papeis.includes(Papel.ALUNO)) return null;
  const aluno = await prisma.aluno.findUnique({
    where: { usuarioId: usuario.id },
    include: {
      alocacoes: {
        where: { ativa: true },
        include: {
          turma: {
            include: { modalidade: true, nivel: { include: { idioma: true } }, professor: { select: { nome: true } } },
          },
        },
      },
      certificados: { include: { nivel: { include: { idioma: true } } }, orderBy: { emitidoEm: "desc" } },
      testesNivel: { include: { nivel: true }, orderBy: { data: "desc" } },
      matriculas: {
        include: {
          cobrancas: {
            where: { status: { in: [StatusCobranca.PENDENTE, StatusCobranca.ATRASADO, StatusCobranca.PAGO] } },
            orderBy: { vencimento: "asc" },
          },
        },
      },
    },
  });
  if (!aluno) return null;

  const turmaAtual = aluno.alocacoes[0]?.turma ?? null;

  // Frequência + boletim da turma atual.
  let presentes = 0;
  let total = 0;
  const boletim: DadosPortal["boletim"] = [];
  let media: number | null = null;
  if (turmaAtual) {
    const [presencas, avaliacoes] = await Promise.all([
      prisma.presenca.findMany({ where: { alunoId: aluno.id, aula: { turmaId: turmaAtual.id } } }),
      prisma.avaliacao.findMany({ where: { turmaId: turmaAtual.id }, include: { notas: { where: { alunoId: aluno.id } } } }),
    ]);
    total = presencas.length;
    presentes = presencas.filter((p) => p.presente).length;
    let somaPesos = 0;
    let somaNotas = 0;
    for (const av of avaliacoes) {
      const nota = av.notas[0] ?? null;
      boletim.push({
        turma: `${turmaAtual.nivel.idioma.nome} ${turmaAtual.nivel.codigo}`,
        avaliacao: av.nome,
        nota: nota ? numero(nota.valor) : null,
        peso: numero(av.peso),
      });
      if (nota) {
        somaPesos += numero(av.peso);
        somaNotas += numero(nota.valor) * numero(av.peso);
      }
    }
    media = somaPesos > 0 ? Math.round((somaNotas / somaPesos) * 10) / 10 : null;
  }

  return {
    aluno: { id: aluno.id, nome: nomeCompleto(aluno), codigo: aluno.codigo },
    turma: turmaAtual
      ? {
          label: `${turmaAtual.modalidade.nome} · ${turmaAtual.nivel.idioma.nome} ${turmaAtual.nivel.codigo}`,
          diasHorario: turmaAtual.diasHorario,
          professor: turmaAtual.professor?.nome ?? null,
        }
      : null,
    frequencia: { pct: total > 0 ? Math.round((presentes / total) * 100) : null, presentes, total },
    boletim,
    media,
    financeiro: aluno.matriculas.flatMap((m) =>
      m.cobrancas.map((c) => ({
        id: c.id,
        tipo: c.tipo === TipoCobranca.MATRICULA ? "Taxa de matrícula" : "Mensalidade",
        competencia: c.competencia,
        valor: numeroOuNull(c.saldo) ?? numero(c.valorNegociado),
        moeda: c.moeda,
        vencimentoISO: c.vencimento.toISOString(),
        status: c.status,
        linkPagamento: c.linkPagamento,
      })),
    ),
    certificados: aluno.certificados.map((c) => ({
      nivel: c.nivel.codigo,
      idioma: c.nivel.idioma.nome,
      codigoValidacao: c.codigoValidacao,
      emitidoEmISO: c.emitidoEm.toISOString(),
    })),
    testesNivel: aluno.testesNivel.map((t) => ({
      nivel: t.nivel.codigo,
      pontuacao: numeroOuNull(t.pontuacao),
      dataISO: t.data.toISOString(),
    })),
  };
}

/** Validação pública de certificado (portal/terceiros) pelo código. */
export async function validarCertificado(codigo: string) {
  if (!/^[0-9A-F]{8,16}$/.test(codigo)) return null;
  const cert = await prisma.certificado.findUnique({
    where: { codigoValidacao: codigo },
    include: {
      nivel: { include: { idioma: true } },
      aluno: { select: { primeiroNome: true, sobrenome: true } },
    },
  });
  if (!cert) return null;
  return {
    aluno: nomeCompleto(cert.aluno),
    nivel: `${cert.nivel.idioma.nome} ${cert.nivel.codigo}`,
    emitidoEmISO: cert.emitidoEm.toISOString(),
  };
}
