import { ReplanejamentoSnapshotSchema } from "./replanejamento-snapshot";

type Encontro = { id: string; inicio: Date; fim: Date; status: string };
type Aplicacao = { id: string; estadoHash: string } | null;
type Decisao = { id: string; aprovada: boolean; estadoHash: string; aplicacao: Aplicacao } | null;
type Revisao = { id: string; estadoHash: string; snapshot: unknown; decisaoConjunta: Decisao };
type Calendario = { id: string; versao: number; replanejamentos?: Revisao[] };

export type AncoraCalendarioOferta =
  | { tipo: "GRADE_PUBLICADA"; calendarioId: string; calendarioVersao: number }
  | { tipo: "REPLANEJAMENTO_APLICADO"; calendarioId: string; calendarioVersao: number; revisaoId: string; decisaoId: string; aplicacaoId: string; estadoHash: string };

function mesmaAgenda(encontros: readonly Encontro[], previsao: NonNullable<ReturnType<typeof ReplanejamentoSnapshotSchema.parse>["revisoes"][number]["previsao"]>) {
  const esperados = new Map<string, { inicio: string; fim: string; status: string }>();
  for (const proposta of previsao.propostas) {
    if (esperados.has(proposta.encontroId)) return false;
    esperados.set(proposta.encontroId, { inicio: proposta.inicioProposto, fim: proposta.fimProposto, status: "PREVISTO" });
  }
  for (const preservado of previsao.preservados) {
    if (esperados.has(preservado.id)) return false;
    esperados.set(preservado.id, { inicio: preservado.inicio, fim: preservado.fim, status: preservado.status });
  }
  return esperados.size === encontros.length && encontros.every((encontro) => {
    const esperado = esperados.get(encontro.id);
    return esperado?.inicio === encontro.inicio.toISOString()
      && esperado.fim === encontro.fim.toISOString()
      && esperado.status === encontro.status;
  });
}

/**
 * Uma grade publicada pode permanecer vinculada ao calendário anterior depois de
 * uma revisão conjunta. A cadeia só é aceita quando a aplicação aprovada da
 * versão vigente contém a própria turma e explica a agenda que está em leitura.
 */
export function ancorarCalendarioOferta(input: {
  grade: { calendarioId: string; calendarioVersao: number };
  calendarioVigente: Calendario | null;
  turmaId: string;
  encontros: readonly Encontro[];
}): AncoraCalendarioOferta | null {
  const { grade, calendarioVigente, turmaId, encontros } = input;
  if (!calendarioVigente) return null;
  if (calendarioVigente.id === grade.calendarioId && calendarioVigente.versao === grade.calendarioVersao) {
    return { tipo: "GRADE_PUBLICADA", calendarioId: calendarioVigente.id, calendarioVersao: calendarioVigente.versao };
  }
  if (calendarioVigente.versao <= grade.calendarioVersao) return null;

  for (const registro of calendarioVigente.replanejamentos ?? []) {
    const decisao = registro.decisaoConjunta;
    if (!decisao?.aprovada || !decisao.aplicacao || decisao.estadoHash !== registro.estadoHash || decisao.aplicacao.estadoHash !== registro.estadoHash) continue;
    const snapshot = ReplanejamentoSnapshotSchema.safeParse(registro.snapshot);
    if (!snapshot.success || snapshot.data.calendarioId !== calendarioVigente.id) continue;
    const revisoesDaTurma = snapshot.data.revisoes.filter((revisao) => revisao.turmaId === turmaId && revisao.previsao !== null);
    const revisaoDaTurma = revisoesDaTurma[0];
    if (revisoesDaTurma.length !== 1 || !revisaoDaTurma?.previsao || !mesmaAgenda(encontros, revisaoDaTurma.previsao)) continue;
    return {
      tipo: "REPLANEJAMENTO_APLICADO", calendarioId: calendarioVigente.id, calendarioVersao: calendarioVigente.versao,
      revisaoId: registro.id, decisaoId: decisao.id, aplicacaoId: decisao.aplicacao.id, estadoHash: registro.estadoHash,
    };
  }
  return null;
}
