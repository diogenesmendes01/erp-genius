import type { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { carregarImpactosFrequenciaAulaTx } from "@/server/avaliacoes/impactos-reposicao-tx";
import { carregarFrequenciaNivelTx, simularFrequenciaCorrecaoAulaTx } from "@/server/avaliacoes/frequencia-nivel-tx";
import { carregarEstadoFechamentoTx, simularFechamentoCorrecaoAulaTx } from "@/server/avaliacoes/fechamento-estado-tx";
import { ConteudoRegraAvaliacaoSchema } from "@/server/avaliacoes/regra-schema";
import { compararCorrecaoAula } from "./correcao-aula-comparacao";
import { carregarDependenciasFinanceirasAulaTx } from "./correcao-aula-financeiro-tx";
import { hashCorrecaoAula } from "./correcao-aula-schema";
import { carregarCorrecaoAulaTx } from "./correcao-aula-tx";
import { carregarReposicoesCorrecaoAulaTx } from "./correcao-aula-reposicoes-tx";
import { carregarReposicoesFrequenciaTx } from "@/server/avaliacoes/frequencia-reposicoes-tx";

/**
 * Conferência interna da proposta Q23. O chamador já autenticou o ator; esta
 * função recompõe autorização fresca, fonte e impactos sob a mesma transação.
 */
export async function carregarImpactosCorrecaoAulaTx(
  tx: Prisma.TransactionClient,
  usuarioId: string,
  propostaId: string,
  instanteReferencia?: Date,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const agora = instanteReferencia ?? new Date();
  const proposta = await tx.propostaCorrecaoAula.findUnique({ where: { id: propostaId }, include: { rejeicao: true, aprovacao: true } });
  if (!proposta) throw new ErroRegra("Proposta de correção não encontrada.");
  if (proposta.rejeicao) throw new ErroRegra("A proposta foi rejeitada. O histórico permanece disponível, sem publicação da correção.");
  if (proposta.aprovacao) throw new ErroRegra("A correção já foi publicada. Consulte a decisão no histórico.");
  const atual = await carregarCorrecaoAulaTx(tx, usuarioId, proposta.encontroId);
  const ator = await tx.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { papeis: true } });
  if (!ator.papeis.some(p => p === "GERENTE_PEDAGOGICO" || p === "ADMINISTRADOR")) throw new ErroRegra("A conferência de impactos exige gestão pedagógica ativa.");
  if (atual.estadoHash !== proposta.estadoHash || atual.versaoAtual !== proposta.versao) throw new ErroRegra("A proposta está desatualizada. Prepare nova conferência da aula.");
  const encontro = await tx.encontroAgenda.findUniqueOrThrow({ where: { id: proposta.encontroId }, select: { inicio: true, turmaId: true, turma: { select: { nivelId: true } } } });
  const matriculas = [...new Set(atual.snapshot.registros.map(r => r.matriculaId))].sort();
  const progressao = [];
  if (encontro.turmaId && encontro.turma) {
    for (const matriculaId of matriculas) {
      const registro = atual.snapshot.registros.find(r => r.matriculaId === matriculaId)!;
      progressao.push(await carregarImpactosFrequenciaAulaTx(tx, { matriculaId, alunoId: registro.alunoId,
        turmaId: encontro.turmaId, nivelId: encontro.turma.nivelId, inicio: encontro.inicio }));
    }
  }
  const reposicoes = await carregarReposicoesCorrecaoAulaTx(tx, proposta.encontroId, matriculas);
  const contexto = { propostaId: proposta.id, propostaHash: proposta.entradaHash, estadoHash: atual.estadoHash,
    progressao, reposicoes: reposicoes.reposicoes, inventarioReposicoes: reposicoes.inventarioReposicoes };
  const comparacao = compararCorrecaoAula(proposta.snapshotAnterior, proposta.snapshotNovo, contexto.reposicoes);
  const simulacoes = [];
  for (const fonte of progressao) {
    const ultimo = await tx.alocacaoTurma.findFirst({ where: { id: fonte.alocacaoFonteId, matriculaId: fonte.matriculaId, turma: { nivelId: fonte.nivelId } },
      select: { id: true, turma: { select: { regraAvaliacao: true } } } });
    const regra = ultimo?.turma.regraAvaliacao;
    if (!regra) {
      simulacoes.push({ matriculaId: fonte.matriculaId, nivelId: fonte.nivelId, regraId: null, pendencia: "Confira a regra do vínculo mais recente antes de simular a frequência.", antes: null, depois: null });
      continue;
    }
    const conteudo = ConteudoRegraAvaliacaoSchema.parse(regra.conteudo);
    const parametros = { matriculaId: fonte.matriculaId, nivelId: fonte.nivelId, minimoPercentual: conteudo.frequenciaMinimaPercentual, agora };
    const registro = comparacao.registros.find(r => r.matriculaId === fonte.matriculaId)!;
    const { apuradaEm: _antesEm, ...antes } = await carregarFrequenciaNivelTx(tx, parametros);
    const { apuradaEm: _depoisEm, ...depois } = await simularFrequenciaCorrecaoAulaTx(tx, parametros, { encontroId: proposta.encontroId,
      registroId: registro.registroId, matriculaId: fonte.matriculaId, participacao: registro.depois.participacao });
    // O instante da consulta não torna obsoleta uma conferência sem mudança de fontes.
    void _antesEm;
    void _depoisEm;
    let fechamento;
    try {
      const anterior = await carregarEstadoFechamentoTx(tx, usuarioId, ultimo!.id, agora);
      const proposto = await simularFechamentoCorrecaoAulaTx(tx, usuarioId, ultimo!.id, { encontroId: proposta.encontroId,
        registroId: registro.registroId, matriculaId: fonte.matriculaId, participacao: registro.depois.participacao }, agora);
      fechamento = { pendencia: null, antes: { estadoHash: anterior.estadoHash, elegibilidade: anterior.elegibilidade },
        depois: { estadoHash: proposto.estadoHash, elegibilidade: proposto.elegibilidade, simulacao: true as const } };
    } catch (erro) {
      if (!(erro instanceof ErroRegra)) throw erro;
      fechamento = { pendencia: erro.message, antes: null, depois: null };
    }
    simulacoes.push({ matriculaId: fonte.matriculaId, nivelId: fonte.nivelId, regraId: regra.id, pendencia: null, antes, depois, fechamento });
  }
  const dependenciasFinanceiras = await carregarDependenciasFinanceirasAulaTx(tx, proposta.encontroId, matriculas);
  const financeiro = { ...dependenciasFinanceiras,
    possuiDependenciasFinanceiras: dependenciasFinanceiras.exigeConferenciaFinanceira,
    exigeConferenciaFinanceira: dependenciasFinanceiras.exigeConferenciaFinanceira && comparacao.registros.some(r => r.participacaoAlterada),
  };
  // Preservar uma conclusão exige sua prova efetiva, não apenas a flag do histórico.
  const reposicoesPreservaveisIds: string[] = [];
  for (const matriculaId of matriculas) {
    const efetivas = await carregarReposicoesFrequenciaTx(tx, { matriculaId, aulaOriginalIds: [proposta.encontroId], apuradaEm: agora });
    for (const fonteEfetiva of efetivas.get(proposta.encontroId) ?? []) {
      const reposicao = contexto.reposicoes.find(r => r.matriculaId === matriculaId && (r.correcaoId ?? r.conclusaoId) === fonteEfetiva.id);
      if (!reposicao) continue;
      const ultimaCorrecao = await tx.correcaoConclusaoReposicaoIndividual.findFirst({ where: {
        conclusaoId: reposicao.conclusaoId!,
      }, orderBy: { versao: "desc" }, select: { decisao: { select: { id: true } } } });
      if (!ultimaCorrecao || ultimaCorrecao.decisao) reposicoesPreservaveisIds.push(reposicao.id);
    }
  }
  reposicoesPreservaveisIds.sort();
  const reposicoesContinuaveisIds = contexto.reposicoes.filter(r => {
    const registro = comparacao.registros.find(c => c.matriculaId === r.matriculaId);
    return r.decisao?.aprovada === true && !r.conclusaoId && registro?.participacaoAlterada
      && registro.antes.participacao !== "PRESENTE" && registro.depois.participacao !== "PRESENTE";
  }).map(r => r.id).sort();
  const revisao = { ...contexto, comparacao, simulacoes, financeiro, reposicoesPreservaveisIds, reposicoesContinuaveisIds };
  return { ...revisao, impactosHash: hashCorrecaoAula(revisao) };
}
