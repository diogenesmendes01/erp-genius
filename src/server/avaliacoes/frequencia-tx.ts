import type { Prisma } from "@prisma/client";
import { carregarHistoricosContratuais } from "@/server/diario/historico-contratual";
import { situacaoMatriculaNaAula } from "@/server/matricula/historico-situacao";
import { apurarFrequenciaNivel } from "./frequencia";
import { carregarReposicoesFrequenciaTx } from "./frequencia-reposicoes-tx";

/** Chamar após autorizar e bloquear o vínculo acadêmico. Não é fechamento do nível. */
export async function carregarFrequenciaVinculoTx(tx: Prisma.TransactionClient, a: {
  id: string; matriculaId: string; alunoId: string; turmaId: string; criadoEm: Date; encerradaEm: Date | null; ativa: boolean;
}, nivelId: string, minimoPercentual: string, agora = new Date()) {
  const pendenciasHistoricas: { origemId: string; motivo: string }[] = [];
  if (!a.ativa && !a.encerradaEm) pendenciasHistoricas.push({ origemId: a.id, motivo: "VINCULO_SEM_LIMITE_HISTORICO" });
  const historico = (await carregarHistoricosContratuais(tx, [a.matriculaId])).get(a.matriculaId);
  const encontros = await tx.encontroAgenda.findMany({ where: {
    finalidade: "AULA", turmaId: a.turmaId, status: { not: "RASCUNHO" }, inicio: { gte: a.criadoEm, lte: agora, ...(a.encerradaEm ? { lt: a.encerradaEm } : {}) },
  }, orderBy: [{ inicio: "asc" }, { id: "asc" }], select: {
    id: true, inicio: true, fim: true, status: true,
    diario: { select: { id: true, registros: { where: { alunoId: a.alunoId }, select: { presente: true, matriculaId: true, participacao: true } } } },
  } });
  const legados = await tx.aulaDiario.findMany({ where: { turmaId: a.turmaId, encontroId: null,
    ocorridaEm: { gte: a.criadoEm, lte: agora, ...(a.encerradaEm ? { lt: a.encerradaEm } : {}) } }, select: { id: true } });
  pendenciasHistoricas.push(...legados.map(l => ({ origemId: l.id, motivo: "DIARIO_SEM_ENCONTRO_CONFERIDO" })));
  const outrosVinculos = await tx.alocacaoTurma.count({ where: { matriculaId: a.matriculaId, id: { not: a.id }, turma: { nivelId } } });
  if (outrosVinculos) pendenciasHistoricas.push({ origemId: a.id, motivo: "CONFERIR_APROVEITAMENTO_ENTRE_VINCULOS" });
  const reposicoesPorAula = await carregarReposicoesFrequenciaTx(tx, {
    matriculaId: a.matriculaId, aulaOriginalIds: encontros.map(e => e.id), apuradaEm: agora,
  });
  const aulas: Parameters<typeof apurarFrequenciaNivel>[0]["aulas"] = [];
  for (const e of encontros) {
    const situacao = historico ? situacaoMatriculaNaAula(historico, e.inicio) : "A_CONFERIR";
    if (situacao === "A_CONFERIR") { pendenciasHistoricas.push({ origemId: e.id, motivo: "SITUACAO_CONTRATUAL_NAO_CONFERIDA" }); continue; }
    if (situacao !== "ATIVA") continue;
    const registro = e.diario?.registros[0];
    if (registro?.matriculaId && registro.matriculaId !== a.matriculaId) { pendenciasHistoricas.push({ origemId: e.id, motivo: "REGISTRO_DE_OUTRO_CONTRATO" }); continue; }
    const presente = registro?.presente;
    // O booleano antigo não identifica impedimento nem reposição aprovada.
    if (presente === false && !registro?.participacao) pendenciasHistoricas.push({ origemId: e.id, motivo: "CONFERIR_AUSENCIA_E_REGULARIZACOES" });
    const participacao = registro?.participacao ?? (presente === true ? "PRESENTE" : presente === false ? "FALTA" : "PENDENTE");
    // A regularização só pode cobrir uma ausência/impedimento já conferido.
    // Presença ou chamada pendente não recebe crédito por existir uma fonte.
    const reposicoes = participacao === "FALTA" || participacao === "IMPEDIDO_POR_RESTRICAO" ? reposicoesPorAula.get(e.id) ?? [] : [];
    aulas.push({ aulaId: e.id, matriculaId: a.matriculaId, nivelId, fim: e.fim.toISOString(),
      situacao: e.status === "MINISTRADO" ? "MINISTRADA" : e.status === "CANCELADO" ? "CANCELADA" : "PREVISTA",
      participacao, reposicoes });
  }
  const apuracao = apurarFrequenciaNivel({ matriculaId: a.matriculaId, nivelId, apuradaEm: agora.toISOString(), minimoPercentual, aulas });
  return { ...apuracao, atendeMinimo: pendenciasHistoricas.length ? null : apuracao.atendeMinimo,
    pendenciasHistoricas, escopo: "VINCULO_ATUAL" as const, alocacaoId: a.id };
}
