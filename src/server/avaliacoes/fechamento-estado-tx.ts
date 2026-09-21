import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { coletarConsolidadoAvaliacoesDoVinculoTx } from "./consolidado-tx";
import { carregarFrequenciaNivelTx, simularFrequenciaCorrecaoAulaTx } from "./frequencia-nivel-tx";
import { carregarPendenciasFechamentoTx } from "./pendencias-fechamento-tx";
import { carregarFontesEquivalenciaTx } from "./fontes-equivalencia-tx";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";
import { avaliarElegibilidadeFechamento } from "./fechamento-elegibilidade";

function canonico(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(canonico);
  if (valor !== null && typeof valor === "object") return Object.fromEntries(
    Object.entries(valor).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([chave, item]) => [chave, canonico(item)]),
  );
  return valor;
}
export const hashFechamento = (valor: unknown) => createHash("sha256").update(JSON.stringify(canonico(valor))).digest("hex");

export type AlocacaoFechamentoBloqueada = {
  id: string;
  matriculaId: string;
  turmaId: string;
};

/**
 * Coleta interna do fechamento sem conferir identidade ou papel. O chamador
 * deve obter `alocacao` com `bloquearLancamento` e autorizar a leitura antes
 * desta chamada, sempre na mesma transação.
 */
export async function coletarEstadoFechamentoTx(
  tx: Prisma.TransactionClient,
  a: AlocacaoFechamentoBloqueada,
  agora = new Date(),
) {
  return coletarEstadoAcademicoTx(tx, a, undefined, agora);
}

async function coletarEstadoAcademicoTx(tx: Prisma.TransactionClient, a: AlocacaoFechamentoBloqueada,
  chamada?: Parameters<typeof simularFrequenciaCorrecaoAulaTx>[2], agora = new Date()) {
  const turma = await tx.turma.findUniqueOrThrow({ where: { id: a.turmaId }, include: { regraAvaliacao: true } });
  if (!turma.regraAvaliacao) throw new ErroRegra("Confira a regra de avaliação antes do fechamento.");
  const vinculos = await tx.alocacaoTurma.findMany({
    where: { matriculaId: a.matriculaId, turma: { nivelId: turma.nivelId } },
    orderBy: [{ criadoEm: "asc" }, { id: "asc" }],
    select: { id: true, turmaId: true, turma: { select: { regraAvaliacaoId: true } } },
  });
  if (vinculos.at(-1)?.id !== a.id) throw new ErroRegra("Use o vínculo mais recente desta matrícula no nível para conferir o fechamento.");
  const regra = ConteudoRegraAvaliacaoSchema.parse(turma.regraAvaliacao.conteudo);
  const consolidado = await coletarConsolidadoAvaliacoesDoVinculoTx(tx, { alocacao: a, turma }, "ACOMPANHAMENTO");
  const parametrosFrequencia = { matriculaId: a.matriculaId, nivelId: turma.nivelId, minimoPercentual: regra.frequenciaMinimaPercentual, agora };
  const frequencia = chamada ? await simularFrequenciaCorrecaoAulaTx(tx, parametrosFrequencia, chamada)
    : await carregarFrequenciaNivelTx(tx, parametrosFrequencia);
  const pendenciasPorVinculo = [];
  for (const vinculo of vinculos) {
    if (!vinculo.turma.regraAvaliacaoId) throw new ErroRegra("Há vínculo histórico sem regra conferida. Regularize antes de fechar o nível.");
    pendenciasPorVinculo.push({ alocacaoId: vinculo.id, ...await carregarPendenciasFechamentoTx(tx, {
      matriculaId: a.matriculaId, nivelId: turma.nivelId, alocacaoId: vinculo.id, regraId: vinculo.turma.regraAvaliacaoId,
    }) });
  }
  const total = structuredClone(pendenciasPorVinculo[0]!);
  for (const item of pendenciasPorVinculo.slice(1)) {
    for (const chave of Object.keys(total.pendenciasOperacionais) as (keyof typeof total.pendenciasOperacionais)[]) total.pendenciasOperacionais[chave] += item.pendenciasOperacionais[chave];
    for (const chave of Object.keys(total.pendenciasSegundaChamada) as (keyof typeof total.pendenciasSegundaChamada)[]) total.pendenciasSegundaChamada[chave] += item.pendenciasSegundaChamada[chave];
  }
  const propostas = await tx.propostaEquivalenciaAvaliacao.findMany({
    where: { matriculaId: a.matriculaId, alocacaoOrigemId: { in: vinculos.map(v => v.id) } },
    orderBy: [{ versao: "desc" }, { id: "desc" }], distinct: ["alocacaoOrigemId", "turmaDestinoId"],
    select: { id: true, decisao: { select: { aprovada: true, aplicacao: { select: { id: true } } } } },
  });
  const equivalenciaPendente = propostas.some(p => !p.decisao || (p.decisao.aprovada && !p.decisao.aplicacao))
    || !!consolidado.aproveitamento?.pendencias.length;
  const contexto = { matriculaId: a.matriculaId, nivelId: turma.nivelId, alocacaoReferenciaId: a.id, regraId: turma.regraAvaliacao.id };
  const excecaoFrequencia = await tx.propostaExcecaoFrequencia.findFirst({
    where: { matriculaId: a.matriculaId, nivelId: turma.nivelId }, orderBy: { versao: "desc" },
    select: { id: true, versao: true, autorId: true, fonteHash: true, motivo: true, evidencias: true,
      alocacaoReferenciaId: true, regraId: true, decisao: { select: { id: true, aprovada: true, decisorId: true, motivo: true } } },
  });
  const excecaoDoContexto = excecaoFrequencia?.alocacaoReferenciaId === a.id && excecaoFrequencia.regraId === turma.regraAvaliacao.id;
  const elegibilidade = avaliarElegibilidadeFechamento({
    notas: consolidado.resultado,
    frequencia: { matriculaId: a.matriculaId, nivelId: turma.nivelId, regraVersao: turma.regraAvaliacao.id,
      fonteHash: frequencia.fonteHash, atendeMinimo: frequencia.atendeMinimo,
      pendenciasHistoricas: frequencia.pendenciasHistoricas.length, pendenciasChamada: frequencia.pendencias.length },
    equivalencia: equivalenciaPendente ? "PENDENTE" : consolidado.aproveitamento ? "APROVADA" : "NAO_NECESSARIA",
    excecaoFrequenciaPendente: !!excecaoFrequencia && !excecaoFrequencia.decisao,
    ...(excecaoDoContexto && excecaoFrequencia?.decisao ? { excecaoFrequencia: {
      matriculaId: a.matriculaId, nivelId: turma.nivelId, regraVersao: turma.regraAvaliacao.id,
      fonteHash: excecaoFrequencia.fonteHash, aprovada: excecaoFrequencia.decisao.aprovada,
      proponenteId: excecaoFrequencia.autorId, decisorId: excecaoFrequencia.decisao.decisorId,
    } } : {}),
    pendenciasOperacionais: total.pendenciasOperacionais, pendenciasSegundaChamada: total.pendenciasSegundaChamada,
  });
  const fontesOficiais = await carregarFontesEquivalenciaTx(tx, { matriculaId: a.matriculaId, alocacaoId: a.id, turmaId: a.turmaId, nivelId: turma.nivelId, regraId: turma.regraAvaliacao.id });
  // Excluir apenas o instante da consulta. Mudanças de fontes e de elegibilidade
  // continuam mudando o hash, inclusive quando um encontro começa ou termina.
  const frequenciaAcademica = "simulacao" in frequencia && "encontroSimuladoId" in frequencia
    ? (({ simulacao, encontroSimuladoId, ...dados }) => {
      void simulacao;
      void encontroSimuladoId;
      return dados;
    })(frequencia)
    : frequencia;
  const { apuradaEm: _apuradaEm, ...frequenciaEstavel } = frequenciaAcademica;
  void _apuradaEm;
  const snapshot = { versao: 1, contexto, consolidado, frequencia: frequenciaEstavel, pendenciasPorVinculo, elegibilidade, fontesOficiais, excecaoFrequencia };
  return { snapshot, estadoHash: hashFechamento(snapshot), contexto, elegibilidade };
}

/** Consulta interna de gestão. Confirmação e revisão devem usar a mesma coleta
 * sob os locks acadêmicos; não aceitar fontes de notas vindas do navegador. */
export async function carregarEstadoFechamentoTx(tx: Prisma.TransactionClient, autorId: string, alocacaoId: string, agora = new Date()) {
  const a = await bloquearLancamento(tx, alocacaoId);
  await conferirGestorAvaliacao(tx, autorId);
  return coletarEstadoFechamentoTx(tx, a, agora);
}

/** Prévia Q23: mantém notas, pendências e exceções reais; não confirma fechamento. */
export async function simularFechamentoCorrecaoAulaTx(tx: Prisma.TransactionClient, autorId: string, alocacaoId: string,
  chamada: Parameters<typeof simularFrequenciaCorrecaoAulaTx>[2], agora = new Date()) {
  const a = await bloquearLancamento(tx, alocacaoId);
  await conferirGestorAvaliacao(tx, autorId);
  const resultado = await coletarEstadoAcademicoTx(tx, a, chamada, agora);
  return { ...resultado, simulacao: true as const };
}
