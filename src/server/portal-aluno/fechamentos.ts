import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroAutenticacao, ErroRegra } from "@/server/_shared";
import { coletarEstadoFechamentoTx } from "@/server/avaliacoes/fechamento-estado-tx";
import { bloquearLancamento } from "@/server/avaliacoes/lancamento-tx";
import { exigirSessaoPortalAluno } from "./sessao";

export type EstadoFechamentoPortalAluno =
  | "SEM_FECHAMENTO"
  | "CONFIRMADO_SUFICIENTE"
  | "CONFIRMADO_INSUFICIENTE"
  | "EM_REVISAO";

export type FechamentoPortalAluno = {
  matriculaId: string;
  nivelId: string;
  estado: EstadoFechamentoPortalAluno;
  versao: number | null;
  confirmadoEm: string | null;
  resumo: ResumoFechamentoPortalAluno | null;
};

type FracaoPortal = { numerador: string; denominador: string };
export type ResumoFechamentoPortalAluno = {
  geral: FracaoPortal | null;
  minimoGeral: string;
  habilidades: Array<{ habilidade: string; resultado: FracaoPortal | null; minimo: string; atendeMinimo: boolean | null }>;
  frequencia: {
    base: number; presencas: number; regularizadas: number; faltas: number; impedimentos: number;
    percentual: FracaoPortal | null; minimoPercentual: string; atendeMinimo: boolean | null;
  };
};

/** Projeção explícita: nunca serializar o snapshot de gestão para o portal. */
function resumirFechamento(atual: Awaited<ReturnType<typeof coletarEstadoFechamentoTx>>): ResumoFechamentoPortalAluno {
  const notas = atual.snapshot.consolidado.resultado;
  const frequencia = atual.snapshot.frequencia;
  const fracao = (valor: FracaoPortal | null) => valor ? { numerador: valor.numerador, denominador: valor.denominador } : null;
  return {
    geral: fracao(notas.geral), minimoGeral: notas.minimoGeral,
    habilidades: notas.habilidades.map(h => ({ habilidade: h.habilidade, resultado: fracao(h.resultado), minimo: h.minimo, atendeMinimo: h.atendeMinimo })),
    frequencia: {
      base: frequencia.base, presencas: frequencia.presencas, regularizadas: frequencia.regularizadas,
      faltas: frequencia.faltas, impedimentos: frequencia.impedimentos,
      percentual: fracao(frequencia.percentual), minimoPercentual: frequencia.minimoPercentual, atendeMinimo: frequencia.atendeMinimo,
    },
  };
}

type ParMatriculaNivel = {
  matriculaId: string;
  nivelId: string;
  alocacaoId: string;
  turmaId: string;
};

const instanteUtc = (valor: Date) => Prisma.sql`${valor}::timestamptz AT TIME ZONE 'UTC'`;

/**
 * A sessão já foi validada para chegar aqui, mas é conferida novamente depois
 * dos locks acadêmicos. Não bloquear Conta/Sessao antes deles: fluxos de
 * identidade não podem inverter essa ordem e criar um deadlock.
 */
async function revalidarSessaoPortalAlunoTx(tx: Prisma.TransactionClient, sessao: {
  sessaoId: string;
  contaId: string;
  alunoId: string;
  email: string;
}) {
  const [atual] = await tx.$queryRaw<Array<{ alunoId: string }>>(Prisma.sql`
    SELECT c."alunoId" AS "alunoId"
    FROM "SessaoPortalAluno" s
    JOIN "ContaPortalAluno" c ON c.id = s."contaId"
    WHERE s.id = ${sessao.sessaoId}
      AND s."contaId" = ${sessao.contaId}
      AND c."alunoId" = ${sessao.alunoId}
      AND c."emailVerificado" = ${sessao.email}
      AND s."revogadaEm" IS NULL
      AND s."expiraEm" > ${instanteUtc(new Date())}
      AND s."versaoConta" = c."versaoSessao"
      AND c.ativa = true
      AND c."emailVerificado" IS NOT NULL
      AND c."senhaHash" IS NOT NULL
    FOR SHARE OF s, c
  `);
  if (!atual) throw new ErroAutenticacao("Sessão do aluno inválida ou expirada.");
  return atual;
}

function selecionarUltimosVinculos(
  alocacoes: Array<{ id: string; matriculaId: string; turmaId: string; criadoEm: Date; turma: { nivelId: string } }>,
) {
  const porContexto = new Map<string, ParMatriculaNivel & { criadoEm: Date }>();
  for (const alocacao of alocacoes) {
    const nivelId = alocacao.turma.nivelId;
    const chave = `${alocacao.matriculaId}\u0000${nivelId}`;
    const anterior = porContexto.get(chave);
    if (!anterior || alocacao.criadoEm > anterior.criadoEm || (alocacao.criadoEm.getTime() === anterior.criadoEm.getTime() && alocacao.id > anterior.alocacaoId)) {
      porContexto.set(chave, {
        matriculaId: alocacao.matriculaId,
        nivelId,
        alocacaoId: alocacao.id,
        turmaId: alocacao.turmaId,
        criadoEm: alocacao.criadoEm,
      });
    }
  }
  return [...porContexto.values()]
    .sort((a, b) => a.matriculaId.localeCompare(b.matriculaId) || a.nivelId.localeCompare(b.nivelId))
    .map(({ matriculaId, nivelId, alocacaoId, turmaId }) => ({ matriculaId, nivelId, alocacaoId, turmaId }));
}

/**
 * Projeção exclusiva da conta do aluno autenticado. Não aceita matrícula,
 * vínculo ou sessão do navegador: a cookie de portal determina todo o escopo.
 */
export async function consultarFechamentosPortalAluno(): Promise<FechamentoPortalAluno[]> {
  const sessao = await exigirSessaoPortalAluno();
  return prisma.$transaction(async (tx) => {
    // Adquirir antes da primeira leitura: em RepeatableRead, uma consulta feita
    // antes de aguardar o lock poderia conservar snapshot anterior a uma
    // correção que acabou de ser confirmada. Os demais coletores acadêmicos
    // usam este mesmo lock; ReadCommitted mantém a revisão ancorada após ele.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
    // Esta é a conferência de dono antes dos locks. A confirmação equivalente
    // depois de cada lock impede reutilizar um vínculo trocado durante a leitura.
    const candidatas = await tx.alocacaoTurma.findMany({
      where: {
        alunoId: sessao.alunoId,
        matriculaId: { not: null },
        matricula: { alunoId: sessao.alunoId },
      },
      orderBy: [{ matriculaId: "asc" }, { criadoEm: "asc" }, { id: "asc" }],
      select: {
        id: true,
        matriculaId: true,
        turmaId: true,
        criadoEm: true,
        turma: { select: { nivelId: true } },
      },
    });
    const pares = selecionarUltimosVinculos(candidatas.map((alocacao) => ({
      ...alocacao,
      matriculaId: alocacao.matriculaId!,
    })));

    const bloqueadas: Array<ParMatriculaNivel & { alocacao: Awaited<ReturnType<typeof bloquearLancamento>> }> = [];
    for (const par of pares) {
      const alocacao = await bloquearLancamento(tx, par.alocacaoId);
      const donaDepoisDoLock = await tx.alocacaoTurma.findFirst({
        where: {
          id: alocacao.id,
          alunoId: sessao.alunoId,
          matriculaId: par.matriculaId,
          turmaId: par.turmaId,
          matricula: { alunoId: sessao.alunoId },
          turma: { nivelId: par.nivelId },
        },
        select: { id: true },
      });
      if (!donaDepoisDoLock || alocacao.matriculaId !== par.matriculaId || alocacao.turmaId !== par.turmaId) {
        throw new ErroAutenticacao("Sessão do aluno inválida ou expirada.");
      }
      bloqueadas.push({ ...par, alocacao });
    }

    await revalidarSessaoPortalAlunoTx(tx, sessao);

    const resposta: FechamentoPortalAluno[] = [];
    for (const { matriculaId, nivelId, alocacao } of bloqueadas) {
      const fechamento = await tx.fechamentoAcademico.findFirst({
        where: { matriculaId, nivelId },
        orderBy: [{ versao: "desc" }, { id: "desc" }],
        select: {
          alocacaoReferenciaId: true,
          regraId: true,
          estadoHash: true,
          resultadoSuficiente: true,
          versao: true,
          confirmadoEm: true,
        },
      });
      if (!fechamento) {
        resposta.push({ matriculaId, nivelId, estado: "SEM_FECHAMENTO", versao: null, confirmadoEm: null, resumo: null });
        continue;
      }

      try {
        const atual = await coletarEstadoFechamentoTx(tx, alocacao);
        const corresponde = atual.contexto.matriculaId === matriculaId
          && atual.contexto.nivelId === nivelId
          && atual.contexto.alocacaoReferenciaId === fechamento.alocacaoReferenciaId
          && atual.contexto.regraId === fechamento.regraId
          && atual.estadoHash === fechamento.estadoHash
          && atual.elegibilidade.podeFechar
          && atual.elegibilidade.podeProgredir === fechamento.resultadoSuficiente;
        resposta.push({
          matriculaId,
          nivelId,
          estado: corresponde
            ? fechamento.resultadoSuficiente ? "CONFIRMADO_SUFICIENTE" : "CONFIRMADO_INSUFICIENTE"
            : "EM_REVISAO",
          versao: fechamento.versao,
          confirmadoEm: fechamento.confirmadoEm.toISOString(),
          resumo: corresponde ? resumirFechamento(atual) : null,
        });
      } catch (erro) {
        if (!(erro instanceof ErroRegra)) throw erro;
        resposta.push({
          matriculaId,
          nivelId,
          estado: "EM_REVISAO",
          resumo: null,
          versao: fechamento.versao,
          confirmadoEm: fechamento.confirmadoEm.toISOString(),
        });
      }
    }
    return resposta;
  });
}
