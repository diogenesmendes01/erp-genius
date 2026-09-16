import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { calcularNotasNivel, HABILIDADES } from "@/server/avaliacoes/calculo";
import { carregarFrequenciaVinculoTx } from "@/server/avaliacoes/frequencia-tx";
import { NotasLancamentoSchema } from "@/server/avaliacoes/lancamento-schema";
import { carregarPendenciasResultadoTx } from "@/server/avaliacoes/pendencias-resultado-tx";
import { ConteudoRegraAvaliacaoSchema } from "@/server/avaliacoes/regra-schema";
import { carregarAproveitamentoAplicadoTx } from "@/server/avaliacoes/aproveitamento-aplicado-tx";
import { carregarFontesEquivalenciaTx } from "@/server/avaliacoes/fontes-equivalencia-tx";
import { exigirSessaoPortalAluno, type SessaoPortalAluno } from "./sessao";

type Habilidade = typeof HABILIDADES[number];

type NotaVisivel = { habilidade: Habilidade; nota: string | null; comentarioAluno: string };

/**
 * Q143: acompanhamento exclusivo do aluno autenticado por alocação.
 * O fechamento institucional por matrícula/nível é consultado separadamente;
 * este cálculo não representa confirmação de resultado final ou progressão.
 */
export type ResultadoPortalAluno = {
  situacao: "PARCIAL_NAO_FINAL";
  resultadoFinal: null;
  matriculas: Array<{
    matriculaId: string;
    codigo: string | null;
    alocacoes: Array<{
      alocacaoId: string;
      nivelId: string;
      idioma: string;
      nivel: string;
      turma: string | null;
      regraVersao: number | null;
      situacao: "PARCIAL_NAO_FINAL" | "PENDENTE_REGRA";
      resultadoFinal: null;
      avaliacoes: Array<{ codigo: string; titulo: string; etapa: "INTERMEDIARIA" | "FINAL"; notas: NotaVisivel[] }>;
      recuperacoes: Array<{ habilidade: Habilidade; nota: string | null; comentarioAluno: string }>;
      frequencia: {
        base: number; presencas: number; regularizadas: number; faltas: number; impedimentos: number;
        percentual: { numerador: string; denominador: string } | null;
        minimoPercentual: string; atendeMinimo: boolean | null; pendencias: number;
      } | null;
      consolidado: {
        completa: boolean; geral: { numerador: string; denominador: string } | null; minimoGeral: string;
        atendeGeral: boolean | null; atendeRequisitosNotas: boolean | null; recuperacoesPendentes: boolean;
        habilidades: Array<{
          habilidade: Habilidade; resultado: { numerador: string; denominador: string } | null;
          minimo: string; atendeMinimo: boolean | null;
          pendencias: Array<"NOTA_AUSENTE" | "AGUARDANDO_OFICIALIZACAO" | "RESULTADO_ORIGINAL_PENDENTE" | "FONTE_APROVEITAMENTO_ALTERADA">;
        }>;
      } | null;
      pendencias: {
        frequenciaHistorica: number; correcoesRegulares: number; correcoesRecuperacao: number;
        planosAguardandoDecisao: number; planosSemDisponibilizacao: number;
        tentativasAguardandoRealizacao: number; habilidadesSemTentativa: number;
        oportunidadesExtrasAguardandoDecisao: number;
      };
    }>;
  }>;
};

function notasVisiveis(valor: unknown): NotaVisivel[] {
  return NotasLancamentoSchema.parse(valor).map((nota) => ({
    habilidade: nota.habilidade,
    nota: nota.nota,
    comentarioAluno: nota.comentarioAluno,
  }));
}

async function montarAlocacaoPortal(
  tx: Prisma.TransactionClient,
  alocacao: {
    id: string; matriculaId: string | null; alunoId: string; turmaId: string; criadoEm: Date; encerradaEm: Date | null; ativa: boolean;
    turma: { nome: string | null; nivelId: string; nivel: { codigo: string; idioma: { nome: string } }; regraAvaliacao: { id: string; versao: number; conteudo: unknown } | null };
  },
) {
  if (!alocacao.matriculaId || !alocacao.turma.regraAvaliacao) {
    return {
      alocacaoId: alocacao.id, nivelId: alocacao.turma.nivelId, idioma: alocacao.turma.nivel.idioma.nome,
      nivel: alocacao.turma.nivel.codigo, turma: alocacao.turma.nome, regraVersao: null,
      situacao: "PENDENTE_REGRA" as const, resultadoFinal: null,
      avaliacoes: [], recuperacoes: [], frequencia: null, consolidado: null,
      pendencias: {
        frequenciaHistorica: 0, correcoesRegulares: 0, correcoesRecuperacao: 0, planosAguardandoDecisao: 0,
        planosSemDisponibilizacao: 0, tentativasAguardandoRealizacao: 0, habilidadesSemTentativa: 0,
        oportunidadesExtrasAguardandoDecisao: 0,
      },
    };
  }
  const regra = ConteudoRegraAvaliacaoSchema.parse(alocacao.turma.regraAvaliacao.conteudo);
  const [registros, realizacoes, aproveitamento] = await Promise.all([
    tx.registroAvaliacaoMatricula.findMany({
      where: { matriculaId: alocacao.matriculaId, alocacaoId: alocacao.id, turmaId: alocacao.turmaId, regraId: alocacao.turma.regraAvaliacao.id },
      select: {
        codigoAvaliacao: true,
        versoes: {
          where: { decisao: { aprovada: true } }, orderBy: [{ versao: "desc" }, { id: "desc" }], take: 1,
          select: {
            notas: true,
            propostasCorrecao: {
              where: { decisao: { aprovada: true } }, orderBy: [{ versao: "desc" }, { id: "desc" }], take: 1,
              select: { notas: true },
            },
          },
        },
      },
    }),
    tx.realizacaoRecuperacao.findMany({
      where: { itemReserva: { reserva: { proposta: {
        alocacaoId: alocacao.id, matriculaId: alocacao.matriculaId, nivelId: alocacao.turma.nivelId,
        regraId: alocacao.turma.regraAvaliacao.id, decisao: { aprovada: true },
      } } } },
      orderBy: [{ realizadaEm: "asc" }, { id: "asc" }],
      select: {
        id: true,
        itemReserva: { select: { habilidade: true, reserva: { select: { proposta: { select: { id: true, atividades: true } } } } } },
        notas: {
          where: { decisao: { aprovada: true } }, orderBy: [{ versao: "desc" }, { id: "desc" }], take: 1,
          select: {
            nota: true, comentarioAluno: true,
            correcoes: {
              where: { decisao: { aprovada: true } }, orderBy: [{ versao: "desc" }, { id: "desc" }], take: 1,
              select: { nota: true, comentarioAluno: true },
            },
          },
        },
      },
    }),
    carregarAproveitamentoAplicadoTx(tx, {
      matriculaId: alocacao.matriculaId,
      alocacaoDestinoId: alocacao.id,
      turmaDestinoId: alocacao.turmaId,
      nivelDestinoId: alocacao.turma.nivelId,
      regraDestinoId: alocacao.turma.regraAvaliacao.id,
    }, (origem) => carregarFontesEquivalenciaTx(tx, origem)),
  ]);
  const porCodigo = new Map(registros.map((registro) => [registro.codigoAvaliacao, registro.versoes[0] ?? null]));
  const aproveitamentoPorRequisito = new Map((aproveitamento?.itens ?? []).map((item) => [
    item.codigoAvaliacao + "\u0000" + item.habilidade,
    item,
  ]));
  const avaliacoes = regra.avaliacoes.flatMap((avaliacao) => {
    const versao = porCodigo.get(avaliacao.codigo);
    if (!versao) return [];
    const notas = notasVisiveis(versao.propostasCorrecao[0]?.notas ?? versao.notas);
    return [{ codigo: avaliacao.codigo, titulo: avaliacao.titulo, etapa: avaliacao.etapa, notas }];
  });
  const recuperacoes = realizacoes.map((realizacao, ordem) => {
    const nota = realizacao.notas[0];
    const corrigida = nota?.correcoes[0];
    const plano = realizacao.itemReserva.reserva.proposta;
    const habilidadesDoPlano = z.array(z.object({ habilidade: z.enum(HABILIDADES) })).parse(plano.atividades);
    return {
      visivel: nota ? { habilidade: realizacao.itemReserva.habilidade as Habilidade, nota: corrigida?.nota ?? nota.nota, comentarioAluno: corrigida?.comentarioAluno ?? nota.comentarioAluno } : null,
      calculo: {
        id: realizacao.id, planoAprovadoId: plano.id, matriculaId: alocacao.matriculaId!, nivelId: alocacao.turma.nivelId,
        regraVersao: alocacao.turma.regraAvaliacao!.id, ordem: ordem + 1,
        habilidadesDoPlano: habilidadesDoPlano.map((item) => item.habilidade),
        notas: [{ habilidade: realizacao.itemReserva.habilidade as Habilidade, nota: corrigida?.nota ?? nota?.nota ?? null, oficial: !!nota }],
      },
    };
  });
  const resultado = calcularNotasNivel({
    matriculaId: alocacao.matriculaId, nivelId: alocacao.turma.nivelId, regraVersao: alocacao.turma.regraAvaliacao.id,
    escala: regra.escala, minimoGeral: regra.minimoGeral,
    habilidades: regra.habilidades.map(({ habilidade, peso, minimo }) => ({ habilidade, peso, minimo })),
    avaliacoes: regra.avaliacoes.map((avaliacao) => {
      const versao = porCodigo.get(avaliacao.codigo);
      const notas = versao ? notasVisiveis(versao.propostasCorrecao[0]?.notas ?? versao.notas) : [];
      return {
        id: avaliacao.codigo, etapa: avaliacao.etapa, peso: avaliacao.peso,
        notas: avaliacao.habilidades.map((habilidade) => {
          const notaLocal = notas.find((item) => item.habilidade === habilidade)?.nota ?? null;
          const aplicada = aproveitamentoPorRequisito.get(avaliacao.codigo + "\u0000" + habilidade);
          const notaAproveitada = aplicada?.situacao === "APROVEITADO" ? aplicada.notaParaConsolidado : null;
          return { habilidade, nota: notaLocal ?? notaAproveitada, oficial: !!versao || notaAproveitada !== null };
        }),
      };
    }),
    recuperacoes: recuperacoes.map((item) => item.calculo),
  });
  const [frequencia, pendencias] = await Promise.all([
    carregarFrequenciaVinculoTx(tx, { ...alocacao, matriculaId: alocacao.matriculaId }, alocacao.turma.nivelId, regra.frequenciaMinimaPercentual),
    carregarPendenciasResultadoTx(tx, {
      alocacaoId: alocacao.id, matriculaId: alocacao.matriculaId, nivelId: alocacao.turma.nivelId, regraId: alocacao.turma.regraAvaliacao.id,
    }),
  ]);
  return {
    alocacaoId: alocacao.id, nivelId: alocacao.turma.nivelId, idioma: alocacao.turma.nivel.idioma.nome,
    nivel: alocacao.turma.nivel.codigo, turma: alocacao.turma.nome, regraVersao: alocacao.turma.regraAvaliacao.versao,
    situacao: "PARCIAL_NAO_FINAL" as const, resultadoFinal: null,
    avaliacoes, recuperacoes: recuperacoes.flatMap((item) => item.visivel ? [item.visivel] : []),
    frequencia: {
      base: frequencia.base, presencas: frequencia.presencas, regularizadas: frequencia.regularizadas,
      faltas: frequencia.faltas, impedimentos: frequencia.impedimentos, percentual: frequencia.percentual,
      minimoPercentual: frequencia.minimoPercentual, atendeMinimo: frequencia.atendeMinimo,
      pendencias: frequencia.pendencias.length + frequencia.pendenciasHistoricas.length,
    },
    consolidado: {
      completa: resultado.completa, geral: resultado.geral, minimoGeral: resultado.minimoGeral,
      atendeGeral: resultado.atendeGeral, atendeRequisitosNotas: resultado.atendeRequisitosNotas,
      recuperacoesPendentes: resultado.recuperacoesPendentes,
      habilidades: resultado.habilidades.map((habilidade) => {
        const pendencias: Array<"NOTA_AUSENTE" | "AGUARDANDO_OFICIALIZACAO" | "RESULTADO_ORIGINAL_PENDENTE" | "FONTE_APROVEITAMENTO_ALTERADA"> =
          (["NOTA_AUSENTE", "AGUARDANDO_OFICIALIZACAO", "RESULTADO_ORIGINAL_PENDENTE"] as const).filter((tipo) => [
            ...habilidade.memoria.flatMap((nota) => nota.pendencia ? [nota.pendencia] : []),
            ...habilidade.memoriaRecuperacao.flatMap((nota) => nota.pendencia ? [nota.pendencia] : []),
          ].includes(tipo));
        if (aproveitamento?.pendencias.some((pendencia) =>
          pendencia.habilidade === habilidade.habilidade && pendencia.situacao === "PENDENTE_FONTE_ALTERADA",
        )) pendencias.push("FONTE_APROVEITAMENTO_ALTERADA");
        return {
          habilidade: habilidade.habilidade, resultado: habilidade.resultado, minimo: habilidade.minimo,
          atendeMinimo: habilidade.atendeMinimo, pendencias,
        };
      }),
    },
    pendencias: { frequenciaHistorica: frequencia.pendenciasHistoricas.length, ...pendencias },
  };
}

/** Não recebe IDs do navegador: a sessão opaca determina aluno, matrículas e vínculos. */
export async function consultarResultadosPortalAluno(sessao?: SessaoPortalAluno): Promise<ResultadoPortalAluno> {
  const identidade = sessao ?? await exigirSessaoPortalAluno();
  return prisma.$transaction(async (tx) => {
    const alocacoes = await tx.alocacaoTurma.findMany({
      where: { alunoId: identidade.alunoId, matriculaId: { not: null }, matricula: { alunoId: identidade.alunoId } },
      orderBy: [{ matriculaId: "asc" }, { criadoEm: "asc" }, { id: "asc" }],
      select: {
        id: true, matriculaId: true, alunoId: true, turmaId: true, criadoEm: true, encerradaEm: true, ativa: true, provenienciaVinculo: true, inicioVigencia: true, fimVigencia: true,
        matricula: { select: { codigo: true } },
        turma: { select: {
          nome: true, nivelId: true, nivel: { select: { codigo: true, idioma: { select: { nome: true } } } },
          regraAvaliacao: { select: { id: true, versao: true, conteudo: true } },
        } },
      },
    });
    const montadas = await Promise.all(alocacoes.map(async (alocacao) => ({
      matriculaId: alocacao.matriculaId!,
      codigoMatricula: alocacao.matricula!.codigo,
      alocacao: await montarAlocacaoPortal(tx, alocacao),
    })));
    const porMatricula = new Map<string, { codigo: string | null; alocacoes: Array<(typeof montadas)[number]["alocacao"]> }>();
    for (const item of montadas) {
      const atual = porMatricula.get(item.matriculaId) ?? { codigo: item.codigoMatricula, alocacoes: [] };
      atual.alocacoes.push(item.alocacao);
      porMatricula.set(item.matriculaId, atual);
    }
    return {
      situacao: "PARCIAL_NAO_FINAL",
      resultadoFinal: null,
      matriculas: [...porMatricula.entries()].map(([matriculaId, itens]) => ({ matriculaId, codigo: itens.codigo, alocacoes: itens.alocacoes })),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
