import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { NotasLancamentoSchema } from "./lancamento-schema";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";
import { calcularNotasNivel, HABILIDADES } from "./calculo";
import { z } from "zod";
import type { FonteOficialEquivalencia } from "./equivalencia-transferencia";
import { carregarAproveitamentoAplicadoTx } from "./aproveitamento-aplicado-tx";

/** Leitura interna após autorização do fluxo. O chamador conserva a mesma
 * transação/snapshot para conferir contexto, preparar e decidir a proposta. */
export async function carregarFontesEquivalenciaTx(tx: Prisma.TransactionClient, contexto: {
  matriculaId: string; alocacaoId: string; turmaId: string; nivelId: string; regraId: string;
}, alocacoesVisitadas: readonly string[] = []): Promise<FonteOficialEquivalencia[]> {
  if (alocacoesVisitadas.includes(contexto.alocacaoId)) {
    throw new ErroRegra("A cadeia de aproveitamentos contém um ciclo de alocações.");
  }
  if (alocacoesVisitadas.length >= 20) {
    throw new ErroRegra("A cadeia de aproveitamentos excede o limite conferível.");
  }
  const proximaCadeia = [...alocacoesVisitadas, contexto.alocacaoId];
  const vinculo = await tx.alocacaoTurma.findFirst({ where: {
    id: contexto.alocacaoId, matriculaId: contexto.matriculaId, turmaId: contexto.turmaId,
    turma: { nivelId: contexto.nivelId, regraAvaliacaoId: contexto.regraId },
  }, select: { id: true } });
  if (!vinculo) throw new ErroRegra("O vínculo ou a regra de origem mudou. Confira o aproveitamento novamente.");
  const regraPersistida = await tx.versaoRegraAvaliacao.findFirst({ where: { id: contexto.regraId, nivelId: contexto.nivelId }, select: { conteudo: true } });
  if (!regraPersistida) throw new ErroRegra("A regra de origem não pertence ao nível conferido.");
  const regra = ConteudoRegraAvaliacaoSchema.parse(regraPersistida.conteudo);

  const registros = await tx.registroAvaliacaoMatricula.findMany({ where: {
    matriculaId: contexto.matriculaId, alocacaoId: contexto.alocacaoId,
    turmaId: contexto.turmaId, regraId: contexto.regraId,
  }, orderBy: [{ codigoAvaliacao: "asc" }, { id: "asc" }], select: {
    id: true, codigoAvaliacao: true,
    versoes: {
      where: { decisao: { aprovada: true } }, orderBy: [{ versao: "desc" }, { id: "desc" }], take: 1,
      select: {
        id: true, versao: true, notas: true, autorId: true, realizadaPorId: true,
        decisao: { select: { id: true, decisorId: true } },
        propostasCorrecao: {
          where: { decisao: { aprovada: true } }, orderBy: [{ versao: "desc" }, { id: "desc" }], take: 1,
          select: { id: true, versao: true, notas: true, autorId: true, decisao: { select: { id: true, decisorId: true } } },
        },
      },
    },
  } });

  // Não escolhemos a maior nota regular: cada avaliação continua sendo uma
  // fonte própria, com seu peso, e o mapa pedagógico pode escolher uma delas.
  const fontesRegulares: FonteOficialEquivalencia[] = registros.flatMap((registro) => {
    const lancamento = registro.versoes[0];
    if (!lancamento?.decisao) return [];
    const correcao = lancamento.propostasCorrecao[0];
    return NotasLancamentoSchema.parse(correcao?.notas ?? lancamento.notas).flatMap((nota) => {
      if (nota.nota === null) return [];
      const fonteHash = createHash("sha256").update(JSON.stringify([
        "REGULAR", contexto.matriculaId, contexto.alocacaoId, contexto.turmaId, contexto.nivelId, contexto.regraId,
        registro.id, registro.codigoAvaliacao, lancamento.id, lancamento.versao,
        lancamento.autorId, lancamento.realizadaPorId, lancamento.decisao,
        correcao?.id ?? null, correcao?.versao ?? null, correcao?.autorId ?? null, correcao?.decisao ?? null,
        nota.habilidade, nota.nota,
      ])).digest("hex");
      return [{
        referenciaId: `${lancamento.id}:${nota.habilidade}`, ...contexto,
        tipoFonte: "REGULAR" as const, codigoAvaliacao: registro.codigoAvaliacao, habilidade: nota.habilidade,
        nota: nota.nota, oficial: true as const, registroId: registro.id,
        decisaoLancamentoId: lancamento.decisao!.id, autorLancamentoId: lancamento.autorId,
        realizadaPorId: lancamento.realizadaPorId, decisaoCorrecaoId: correcao?.decisao?.id ?? null,
        lancamentoId: lancamento.id, versaoLancamento: lancamento.versao,
        correcaoId: correcao?.id ?? null, versaoCorrecao: correcao?.versao ?? null, fonteHash,
      }];
    });
  });
  // Esta leitura também revalida uma aplicação anterior da alocação atual.
  // Ela vem antes do motor Q133: recuperação compara a tentativa com o
  // resultado consolidado efetivo, que pode conter requisitos aproveitados.
  const aplicado = await carregarAproveitamentoAplicadoTx(tx, {
    matriculaId: contexto.matriculaId,
    alocacaoDestinoId: contexto.alocacaoId,
    turmaDestinoId: contexto.turmaId,
    nivelDestinoId: contexto.nivelId,
    regraDestinoId: contexto.regraId,
  }, (origem) => carregarFontesEquivalenciaTx(tx, origem, proximaCadeia));
  const fontesBase = [...fontesRegulares, ...(aplicado?.fontesAproveitadas ?? [])];

  const realizacoes = await tx.realizacaoRecuperacao.findMany({ where: {
    itemReserva: { reserva: { proposta: {
      matriculaId: contexto.matriculaId, alocacaoId: contexto.alocacaoId, nivelId: contexto.nivelId, regraId: contexto.regraId,
      decisao: { aprovada: true },
    } } },
  }, orderBy: [{ realizadaEm: "asc" }, { id: "asc" }], select: {
    id: true, itemReservaId: true, professorId: true, registradaPorId: true,
    itemReserva: { select: { habilidade: true, reserva: { select: { id: true, proposta: {
      select: { id: true, atividades: true, decisao: { select: { id: true } } },
    } } } } },
    notas: { where: { decisao: { aprovada: true } }, orderBy: [{ versao: "desc" }, { id: "desc" }], take: 1, select: {
      id: true, versao: true, nota: true, autorId: true, decisao: { select: { id: true, decisorId: true } },
      correcoes: { where: { decisao: { aprovada: true } }, orderBy: [{ versao: "desc" }, { id: "desc" }], take: 1,
        select: { id: true, versao: true, nota: true, autorId: true, decisao: { select: { id: true, decisorId: true } } } },
    } },
  } });

  // Q133: a recuperação compete com o resultado consolidado da habilidade,
  // não com uma nota regular isolada. O motor mantém pesos e a cadeia completa.
  const recuperacoesCalculo = realizacoes.map((realizacao, indice) => {
    const nota = realizacao.notas[0];
    const correcao = nota?.correcoes[0];
    return {
      id: realizacao.id, planoAprovadoId: realizacao.itemReserva.reserva.proposta.id,
      matriculaId: contexto.matriculaId, nivelId: contexto.nivelId, regraVersao: contexto.regraId, ordem: indice + 1,
      habilidadesDoPlano: z.array(z.object({ habilidade: z.enum(HABILIDADES) })).parse(realizacao.itemReserva.reserva.proposta.atividades).map(a => a.habilidade),
      notas: [{ habilidade: z.enum(HABILIDADES).parse(realizacao.itemReserva.habilidade), nota: correcao?.nota ?? nota?.nota ?? null, oficial: !!nota?.decisao }],
    };
  });
  const resultado = calcularNotasNivel({
    matriculaId: contexto.matriculaId, nivelId: contexto.nivelId, regraVersao: contexto.regraId,
    escala: regra.escala, minimoGeral: regra.minimoGeral,
    habilidades: regra.habilidades.map(({ habilidade, peso, minimo }) => ({ habilidade, peso, minimo })),
    avaliacoes: regra.avaliacoes.map(avaliacao => {
      return { id: avaliacao.codigo, etapa: avaliacao.etapa, peso: avaliacao.peso,
        notas: avaliacao.habilidades.map(habilidade => {
          const fonte = fontesBase.find((atual) => atual.codigoAvaliacao === avaliacao.codigo && atual.habilidade === habilidade);
          return { habilidade, nota: fonte?.nota ?? null, oficial: fonte?.oficial === true };
        }) };
    }),
    recuperacoes: recuperacoesCalculo,
  });

  const ultimaMelhoriaPorHabilidade = new Map<string, string>();
  for (const resultadoHabilidade of resultado.habilidades) {
    for (const memoria of resultadoHabilidade.memoriaRecuperacao) {
      if (memoria.melhorou) ultimaMelhoriaPorHabilidade.set(resultadoHabilidade.habilidade, memoria.tentativaId);
    }
  }
  const fontesRecuperacao: FonteOficialEquivalencia[] = realizacoes.flatMap((realizacao) => {
    const habilidadeAtual = z.enum(HABILIDADES).parse(realizacao.itemReserva.habilidade);
    if (ultimaMelhoriaPorHabilidade.get(habilidadeAtual) !== realizacao.id) return [];
    const nota = realizacao.notas[0];
    const correcao = nota?.correcoes[0];
    const notaVigente = correcao?.nota ?? nota?.nota;
    const decisaoPlano = realizacao.itemReserva.reserva.proposta.decisao;
    if (!nota?.decisao || !notaVigente || !decisaoPlano) return [];
    const fonteHash = createHash("sha256").update(JSON.stringify([
      "RECUPERACAO", contexto.matriculaId, contexto.alocacaoId, contexto.turmaId, contexto.nivelId, contexto.regraId,
      realizacao.id, realizacao.itemReservaId, realizacao.itemReserva.reserva.id, realizacao.itemReserva.reserva.proposta.id, decisaoPlano.id,
      nota.id, nota.versao, nota.autorId, nota.decisao, correcao?.id ?? null, correcao?.versao ?? null, correcao?.autorId ?? null, correcao?.decisao ?? null,
      realizacao.professorId, realizacao.registradaPorId, habilidadeAtual, notaVigente,
    ])).digest("hex");
    return [{
      referenciaId: `recuperacao:${nota.id}:${habilidadeAtual}`, ...contexto,
      tipoFonte: "RECUPERACAO" as const, escopoFonte: "HABILIDADE" as const, codigoAvaliacao: null,
      habilidade: habilidadeAtual, nota: notaVigente, oficial: true as const,
      realizacaoId: realizacao.id, itemReservaId: realizacao.itemReservaId, reservaId: realizacao.itemReserva.reserva.id,
      planoId: realizacao.itemReserva.reserva.proposta.id, decisaoPlanoId: decisaoPlano.id,
      notaRecuperacaoId: nota.id, decisaoNotaRecuperacaoId: nota.decisao.id, autorNotaRecuperacaoId: nota.autorId,
      professorRealizacaoId: realizacao.professorId, registradaPorId: realizacao.registradaPorId,
      versaoNotaRecuperacao: nota.versao, correcaoRecuperacaoId: correcao?.id ?? null,
      decisaoCorrecaoRecuperacaoId: correcao?.decisao?.id ?? null, versaoCorrecaoRecuperacao: correcao?.versao ?? null,
      fonteHash,
    }];
  });
  return [...fontesBase, ...fontesRecuperacao];
}

