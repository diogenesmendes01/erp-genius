import type { ParticipacaoAula } from "@prisma/client";
import { snapshotCorrecaoAulaSchema, type SnapshotCorrecaoAula } from "./correcao-aula-schema";

function assertConjuntoUnico(valores: string[], campo: string) {
  if (new Set(valores).size !== valores.length) {
    throw new Error(`A correção não pode duplicar ${campo} na chamada.`);
  }
}

/**
 * Confere que a proposta preserva a fonte e as identidades da chamada.
 * A ordem recebida para o novo snapshot não integra a identidade: ela é
 * normalizada pela ordem original para produzir uma projeção determinística.
 */
export function validarProjecaoCorrecaoAula(anteriorJson: unknown, novoJson: unknown): {
  anterior: SnapshotCorrecaoAula;
  novo: SnapshotCorrecaoAula;
} {
  const anterior = snapshotCorrecaoAulaSchema.parse(anteriorJson);
  const novoLido = snapshotCorrecaoAulaSchema.parse(novoJson);

  if (anterior.encontroId !== novoLido.encontroId || anterior.diarioId !== novoLido.diarioId) {
    throw new Error("A correção deve preservar o encontro e o diário da fonte original.");
  }
  if (JSON.stringify(anterior.gravacao) !== JSON.stringify(novoLido.gravacao)) {
    throw new Error("A correção não pode alterar a fonte de gravação da aula.");
  }

  for (const [nome, snapshot] of [["anterior", anterior], ["novo", novoLido]] as const) {
    assertConjuntoUnico(snapshot.registros.map(registro => registro.registroId), `registroId no snapshot ${nome}`);
    assertConjuntoUnico(snapshot.registros.map(registro => registro.alunoId), `alunoId no snapshot ${nome}`);
    assertConjuntoUnico(snapshot.registros.map(registro => registro.matriculaId), `matriculaId no snapshot ${nome}`);
  }

  if (anterior.registros.length !== novoLido.registros.length) {
    throw new Error("A correção deve preservar exatamente os registros da chamada original.");
  }
  const novoPorRegistroId = new Map(novoLido.registros.map(registro => [registro.registroId, registro]));
  const novo = {
    ...novoLido,
    registros: anterior.registros.map(registroAnterior => {
      const registroNovo = novoPorRegistroId.get(registroAnterior.registroId);
      if (!registroNovo
        || registroNovo.alunoId !== registroAnterior.alunoId
        || registroNovo.matriculaId !== registroAnterior.matriculaId
        || registroNovo.nomeAluno !== registroAnterior.nomeAluno) {
        throw new Error("A correção deve preservar a identidade e o nome de cada registro da chamada.");
      }
      return { ...registroNovo };
    }),
  };
  return { anterior, novo };
}

/** Projeta somente a classificação solicitada, sem alterar o registro recebido. */
export function projetarParticipacaoCorrecaoAula<T extends {
  id: string;
  matriculaId: string | null;
  presente: boolean | null;
  participacao: ParticipacaoAula | null;
}>(registro: T, alvo: { registroId: string; matriculaId: string; participacao: ParticipacaoAula }): Omit<T, "presente" | "participacao"> & { presente: boolean; participacao: ParticipacaoAula } {
  if (!alvo.registroId || !alvo.matriculaId || !["PRESENTE", "FALTA", "IMPEDIDO_POR_RESTRICAO"].includes(alvo.participacao)) {
    throw new Error("Confira a identidade e a classificação da projeção.");
  }
  if (registro.id !== alvo.registroId || registro.matriculaId !== alvo.matriculaId) {
    throw new Error("A projeção deve apontar para o mesmo registro e matrícula.");
  }
  return {
    ...registro,
    presente: alvo.participacao === "PRESENTE",
    participacao: alvo.participacao,
  };
}
