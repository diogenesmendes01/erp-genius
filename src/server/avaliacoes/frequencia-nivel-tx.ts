import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { carregarHistoricosContratuais } from "@/server/diario/historico-contratual";
import { situacaoMatriculaNaAula } from "@/server/matricula/historico-situacao";
import { apurarFrequenciaNivel } from "./frequencia";
import { carregarReposicoesFrequenciaTx } from "./frequencia-reposicoes-tx";
import { projetarParticipacaoCorrecaoAula } from "@/server/diario/correcao-aula-projecao";
import { carregarCorrecoesAulaEfetivasTx } from "@/server/diario/correcao-aula-efetiva-tx";

export type ContextoFrequenciaNivel = {
  matriculaId: string;
  nivelId: string;
  minimoPercentual: string;
  agora?: Date;
};

type PendenciaHistorica = { origemId: string; motivo: string };
type VinculoNivel = {
  id: string;
  alunoId: string;
  matriculaId: string | null;
  turmaId: string;
  criadoEm: Date;
  encerradaEm: Date | null;
  ativa: boolean;
};

const ordenarPendencias = (pendencias: PendenciaHistorica[]) => pendencias
  .sort((a, b) => a.motivo.localeCompare(b.motivo) || a.origemId.localeCompare(b.origemId));

function cobreInstante(vinculo: VinculoNivel, instante: Date) {
  return instante >= vinculo.criadoEm && (!vinculo.encerradaEm || instante < vinculo.encerradaEm);
}

function hashFontes(entrada: unknown) {
  return createHash("sha256").update(JSON.stringify(entrada)).digest("hex");
}

/**
 * Q154: apura toda a trajetória conferida da mesma matrícula no nível. A
 * transferência de turma não apaga frequência já ocorrida, mas uma aula só
 * entra uma vez e apenas se tiver um único vínculo histórico que a cubra.
 *
 * `fonteHash` representa fatos persistidos (vínculos, aulas, chamada e
 * reposições), nunca o relógio da consulta. `apuradaEm` decide apenas se um
 * encontro ainda está por realizar e, portanto, se o fechamento é temporalmente
 * possível naquele instante.
 */
export async function carregarFrequenciaNivelTx(
  tx: Prisma.TransactionClient,
  contexto: ContextoFrequenciaNivel,
) {
  return apurarFontesFrequenciaNivelTx(tx, contexto);
}

type ChamadaSimulada = {
  encontroId: string; registroId: string; matriculaId: string;
  participacao: "PRESENTE" | "FALTA" | "IMPEDIDO_POR_RESTRICAO";
};

/** Uso interno na conferência Q23. Não persiste nem substitui a apuração oficial. */
export async function simularFrequenciaCorrecaoAulaTx(tx: Prisma.TransactionClient, contexto: ContextoFrequenciaNivel, chamada: ChamadaSimulada) {
  if (chamada.matriculaId !== contexto.matriculaId) throw new ErroRegra("A simulação pertence a outra matrícula.");
  const resultado = await apurarFontesFrequenciaNivelTx(tx, contexto, chamada);
  return { ...resultado, simulacao: true as const, encontroSimuladoId: chamada.encontroId };
}

async function apurarFontesFrequenciaNivelTx(tx: Prisma.TransactionClient, contexto: ContextoFrequenciaNivel, chamada?: ChamadaSimulada) {
  const agora = contexto.agora ?? new Date();
  const matricula = await tx.matricula.findUnique({
    where: { id: contexto.matriculaId },
    select: { alunoId: true },
  });
  if (!matricula) throw new ErroRegra("Matrícula não encontrada para a frequência do nível.");

  const [vinculos, legados, historico] = await Promise.all([
    tx.alocacaoTurma.findMany({
      where: { matriculaId: contexto.matriculaId, turma: { nivelId: contexto.nivelId } },
      orderBy: [{ criadoEm: "asc" }, { id: "asc" }],
      select: { id: true, alunoId: true, matriculaId: true, turmaId: true, criadoEm: true, encerradaEm: true, ativa: true },
    }),
    // Não é seguro inferir que um vínculo legado do mesmo aluno pertence a
    // esta matrícula. Ele fica explícito até uma conferência própria.
    tx.alocacaoTurma.findMany({
      where: { alunoId: matricula.alunoId, matriculaId: null, turma: { nivelId: contexto.nivelId } },
      orderBy: [{ criadoEm: "asc" }, { id: "asc" }],
      select: { id: true, alunoId: true, matriculaId: true, turmaId: true, criadoEm: true, encerradaEm: true, ativa: true },
    }),
    carregarHistoricosContratuais(tx, [contexto.matriculaId]),
  ]);
  const pendenciasHistoricas: PendenciaHistorica[] = [];
  const vinculosConferidos = vinculos as VinculoNivel[];
  for (const vinculo of vinculosConferidos) {
    if (!vinculo.ativa && !vinculo.encerradaEm) pendenciasHistoricas.push({ origemId: vinculo.id, motivo: "VINCULO_SEM_LIMITE_HISTORICO" });
    if (vinculo.encerradaEm && vinculo.encerradaEm <= vinculo.criadoEm) pendenciasHistoricas.push({ origemId: vinculo.id, motivo: "INTERVALO_DE_VINCULO_INVALIDO" });
  }
  for (const legado of legados) {
    pendenciasHistoricas.push({ origemId: legado.id, motivo: "VINCULO_LEGADO_SEM_MATRICULA" });
    if (!legado.ativa && !legado.encerradaEm) pendenciasHistoricas.push({ origemId: legado.id, motivo: "VINCULO_LEGADO_SEM_LIMITE_HISTORICO" });
  }
  for (let indice = 0; indice < vinculosConferidos.length; indice++) {
    const atual = vinculosConferidos[indice]!;
    for (const posterior of vinculosConferidos.slice(indice + 1)) {
      // Um ativo é aberto até o instante da apuração. Isso detecta uma linha
      // histórica indevidamente mantida aberta sem presumir data de término.
      const fimAtual = atual.encerradaEm ?? agora;
      const fimPosterior = posterior.encerradaEm ?? agora;
      if (atual.criadoEm < fimPosterior && posterior.criadoEm < fimAtual) {
        pendenciasHistoricas.push({ origemId: `${atual.id}:${posterior.id}`, motivo: "VINCULOS_SOBREPOSTOS_NO_NIVEL" });
      }
    }
  }

  if (!vinculosConferidos.length) {
    if (chamada) throw new ErroRegra("A aula simulada não possui vínculo conferido neste nível.");
    pendenciasHistoricas.push({ origemId: contexto.matriculaId, motivo: "SEM_VINCULO_CONFERIDO_NO_NIVEL" });
    const apuracaoVazia = apurarFrequenciaNivel({
      matriculaId: contexto.matriculaId,
      nivelId: contexto.nivelId,
      apuradaEm: agora.toISOString(),
      minimoPercentual: contexto.minimoPercentual,
      aulas: [],
    });
    return {
      ...apuracaoVazia,
      atendeMinimo: null,
      pendenciasHistoricas: ordenarPendencias(pendenciasHistoricas),
      fonteHash: hashFontes({ versao: 1, matriculaId: contexto.matriculaId, nivelId: contexto.nivelId, minimoPercentual: contexto.minimoPercentual, vinculos: [], aulas: [], pendencias: ordenarPendencias(pendenciasHistoricas) }),
      fontes: [],
      alocacoesIds: [],
      escopo: "MATRICULA_NIVEL" as const,
    };
  }

  const turmaIds = [...new Set(vinculosConferidos.map(vinculo => vinculo.turmaId))];
  const [encontros, diariosLegados] = await Promise.all([
    tx.encontroAgenda.findMany({
      where: { finalidade: "AULA", turmaId: { in: turmaIds }, status: { not: "RASCUNHO" } },
      orderBy: [{ inicio: "asc" }, { id: "asc" }],
      select: {
        id: true, turmaId: true, inicio: true, fim: true, status: true,
        diario: { select: { registros: { where: { alunoId: matricula.alunoId }, select: { id: true, presente: true, matriculaId: true, participacao: true } } } },
      },
    }),
    tx.aulaDiario.findMany({
      where: { turmaId: { in: turmaIds }, encontroId: null },
      orderBy: [{ ocorridaEm: "asc" }, { id: "asc" }],
      select: { id: true, turmaId: true, ocorridaEm: true },
    }),
  ]);
  const aulasCandidatas: Array<{
    aulaId: string;
    turmaId: string;
    inicio: Date;
    fim: Date;
    situacao: "PREVISTA" | "MINISTRADA" | "CANCELADA";
    participacao: "PRESENTE" | "FALTA" | "IMPEDIDO_POR_RESTRICAO" | "PENDENTE";
  }> = [];
  const encontrosFuturos: PendenciaHistorica[] = [];
  const fontesFuturas: Array<{ aulaId: string; turmaId: string; inicio: Date; fim: Date; situacao: "PREVISTA" | "MINISTRADA" | "CANCELADA"; participacao: "PRESENTE" | "FALTA" | "IMPEDIDO_POR_RESTRICAO" | "PENDENTE" }> = [];
  const historicoMatricula = historico.get(contexto.matriculaId);
  const correcoes = await carregarCorrecoesAulaEfetivasTx(tx, encontros.filter(e => e.status === "MINISTRADO").map(e => e.id));
  let simulacaoAplicada = false;
  for (const encontro of encontros) {
    const correcao = correcoes.get(encontro.id);
    const registroOriginal = encontro.diario?.registros[0];
    if (correcao && registroOriginal) {
      const efetivo = correcao.snapshot.registros.find(r => r.registroId === registroOriginal.id);
      if (!efetivo || efetivo.alunoId !== matricula.alunoId || efetivo.matriculaId !== registroOriginal.matriculaId) {
        throw new ErroRegra("Confira o vínculo da correção publicada antes de apurar a frequência.");
      }
      encontro.diario!.registros[0] = projetarParticipacaoCorrecaoAula(registroOriginal, efetivo);
    }
    if (chamada?.encontroId === encontro.id) {
      const registro = encontro.diario?.registros[0];
      if (encontro.status !== "MINISTRADO" || !registro || registro.id !== chamada.registroId || registro.matriculaId !== contexto.matriculaId) {
        throw new ErroRegra("Confira a aula ministrada e o registro da matrícula antes de simular.");
      }
      encontro.diario!.registros[0] = projetarParticipacaoCorrecaoAula(registro, chamada);
    }
    if (!encontro.turmaId) {
      pendenciasHistoricas.push({ origemId: encontro.id, motivo: "AULA_SEM_TURMA_CONFERIDA" });
      continue;
    }
    const candidatos = vinculosConferidos.filter(vinculo => vinculo.turmaId === encontro.turmaId && cobreInstante(vinculo, encontro.inicio));
    if (candidatos.length !== 1) {
      pendenciasHistoricas.push({ origemId: encontro.id, motivo: candidatos.length ? "AULA_EM_VINCULOS_SOBREPOSTOS" : "AULA_FORA_DE_VINCULO_CONFERIDO" });
      continue;
    }
    const situacaoEncontro = encontro.status === "MINISTRADO" ? "MINISTRADA" : encontro.status === "CANCELADO" ? "CANCELADA" : "PREVISTA";
    const participacao = encontro.diario?.registros[0]?.participacao
      ?? (encontro.diario?.registros[0]?.presente === true ? "PRESENTE" : encontro.diario?.registros[0]?.presente === false ? "FALTA" : "PENDENTE");
    if (situacaoEncontro === "PREVISTA" && encontro.fim > agora) {
      encontrosFuturos.push({ origemId: encontro.id, motivo: "ENCONTROS_A_REALIZAR" });
      fontesFuturas.push({ aulaId: encontro.id, turmaId: encontro.turmaId, inicio: encontro.inicio, fim: encontro.fim, situacao: situacaoEncontro, participacao });
      continue;
    }
    const situacaoContratual = historicoMatricula ? situacaoMatriculaNaAula(historicoMatricula, encontro.inicio) : "A_CONFERIR";
    if (situacaoContratual === "A_CONFERIR") {
      pendenciasHistoricas.push({ origemId: encontro.id, motivo: "SITUACAO_CONTRATUAL_NAO_CONFERIDA" });
      continue;
    }
    if (situacaoContratual !== "ATIVA") continue;
    const registro = encontro.diario?.registros[0];
    if (registro?.matriculaId && registro.matriculaId !== contexto.matriculaId) {
      pendenciasHistoricas.push({ origemId: encontro.id, motivo: "REGISTRO_DE_OUTRO_CONTRATO" });
      continue;
    }
    if (registro?.presente === false && !registro.participacao) pendenciasHistoricas.push({ origemId: encontro.id, motivo: "CONFERIR_AUSENCIA_E_REGULARIZACOES" });
    if (chamada?.encontroId === encontro.id) simulacaoAplicada = true;
    aulasCandidatas.push({
      aulaId: encontro.id,
      turmaId: encontro.turmaId,
      inicio: encontro.inicio,
      fim: encontro.fim,
      situacao: situacaoEncontro,
      participacao,
    });
  }
  if (chamada && !simulacaoAplicada) throw new ErroRegra("A aula simulada não integra a frequência conferida da matrícula neste nível.");
  for (const diario of diariosLegados) {
    const candidatos = vinculosConferidos.filter(vinculo => vinculo.turmaId === diario.turmaId && cobreInstante(vinculo, diario.ocorridaEm));
    if (candidatos.length === 1) pendenciasHistoricas.push({ origemId: diario.id, motivo: "DIARIO_SEM_ENCONTRO_CONFERIDO" });
    else pendenciasHistoricas.push({ origemId: diario.id, motivo: candidatos.length ? "DIARIO_EM_VINCULOS_SOBREPOSTOS" : "DIARIO_FORA_DE_VINCULO_CONFERIDO" });
  }

  const reposicoesPorAula = await carregarReposicoesFrequenciaTx(tx, {
    matriculaId: contexto.matriculaId,
    aulaOriginalIds: aulasCandidatas.map(aula => aula.aulaId),
    apuradaEm: agora,
  });
  const aulas = aulasCandidatas.map(aula => ({
    aulaId: aula.aulaId,
    matriculaId: contexto.matriculaId,
    nivelId: contexto.nivelId,
    fim: aula.fim.toISOString(),
    situacao: aula.situacao,
    participacao: aula.participacao,
    reposicoes: aula.participacao === "FALTA" || aula.participacao === "IMPEDIDO_POR_RESTRICAO"
      ? reposicoesPorAula.get(aula.aulaId) ?? []
      : [],
  }));
  const apuracao = apurarFrequenciaNivel({
    matriculaId: contexto.matriculaId,
    nivelId: contexto.nivelId,
    apuradaEm: agora.toISOString(),
    minimoPercentual: contexto.minimoPercentual,
    aulas,
  });
  const todasPendencias = ordenarPendencias([...pendenciasHistoricas, ...encontrosFuturos]);
  const fontes = [...aulasCandidatas, ...fontesFuturas].map(aula => ({
    aulaId: aula.aulaId,
    turmaId: aula.turmaId,
    inicio: aula.inicio.toISOString(),
    fim: aula.fim.toISOString(),
    situacao: aula.situacao,
    participacao: aula.participacao,
    reposicoes: (reposicoesPorAula.get(aula.aulaId) ?? []).map(reposicao => ({
      id: reposicao.id,
      aulaOriginalId: reposicao.aulaOriginalId,
      modalidade: reposicao.modalidade,
      validadaEm: reposicao.validadaEm,
    })),
  })).sort((a, b) => a.inicio.localeCompare(b.inicio) || a.aulaId.localeCompare(b.aulaId));
  return {
    ...apuracao,
    atendeMinimo: todasPendencias.length ? null : apuracao.atendeMinimo,
    pendenciasHistoricas: todasPendencias,
    fonteHash: hashFontes({
      versao: 1,
      matriculaId: contexto.matriculaId,
      nivelId: contexto.nivelId,
      minimoPercentual: contexto.minimoPercentual,
      // Fechar o vínculo ao executar a progressão não muda frequência já
      // conferida. Os limites continuam selecionando as aulas e produzindo
      // pendências; quando afetarem a apuração, essas fontes mudarão o hash.
      vinculos: vinculosConferidos.map(vinculo => ({ id: vinculo.id, turmaId: vinculo.turmaId, criadoEm: vinculo.criadoEm.toISOString() })),
      fontes,
      // A classificação temporal de futuro/passado não compõe o hash.
      pendenciasPersistidas: ordenarPendencias(pendenciasHistoricas),
    }),
    fontes,
    alocacoesIds: vinculosConferidos.map(vinculo => vinculo.id),
    escopo: "MATRICULA_NIVEL" as const,
  };
}
