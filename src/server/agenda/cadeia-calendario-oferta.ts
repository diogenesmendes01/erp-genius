import { z } from "zod";
import { ReplanejamentoSnapshotSchema } from "./replanejamento-snapshot";

type Encontro = { id: string; inicio: Date; fim: Date; status: string };
type Aplicacao = { id: string; estadoHash: string; aplicadaEm?: Date } | null;
type Decisao = { id: string; aprovada: boolean; estadoHash: string; aplicacao: Aplicacao } | null;
type Revisao = { id: string; estadoHash: string; snapshot: unknown; decisaoConjunta: Decisao };
type Calendario = { id: string; versao: number; replanejamentos?: Revisao[] };

const EncontroFotografado = z.object({ id: z.string().nullable(), inicio: z.string(), fim: z.string(), status: z.string() });
const ImpactoQuantidadeSchema = z.object({ agendaAntes: z.array(EncontroFotografado), agendaDepois: z.array(EncontroFotografado) });
export type ElosQuantidade = Array<{ propostaId: string; decisaoId: string; aplicacaoId: string; estadoHash: string }>;

/** Alteração de quantidade de aulas da modalidade, com o impacto fotografado para a turma em leitura. */
export type AlteracaoQuantidadeOferta = {
  propostaId: string; estadoHash: string; impactoSnapshot: unknown;
  decisao: { id: string; aprovada: boolean; estadoHash: string } | null;
  aplicacao: { id: string; estadoHash: string; aplicadaEm: Date } | null;
};

export type AncoraCalendarioOferta =
  | { tipo: "GRADE_PUBLICADA"; calendarioId: string; calendarioVersao: number }
  | { tipo: "REPLANEJAMENTO_APLICADO"; calendarioId: string; calendarioVersao: number; revisaoId: string; decisaoId: string; aplicacaoId: string; estadoHash: string; alteracoesQuantidade?: ElosQuantidade };

type Esperado = { inicio: string; fim: string; status: string };

/**
 * O diário conclui a aula depois da fotografia: PREVISTO→MINISTRADO no mesmo
 * horário é evolução legítima, não divergência. Qualquer outro status continua
 * exigindo a cadeia aprovada que o explique.
 */
const statusCoerente = (esperado: string, atual: string) => esperado === atual || (esperado === "PREVISTO" && atual === "MINISTRADO");
const mesmoEncontro = (esperado: Esperado | undefined, encontro: Encontro) => !!esperado
  && esperado.inicio === encontro.inicio.toISOString()
  && esperado.fim === encontro.fim.toISOString()
  && statusCoerente(esperado.status, encontro.status);

function agendaPrevista(previsao: NonNullable<ReturnType<typeof ReplanejamentoSnapshotSchema.parse>["revisoes"][number]["previsao"]>) {
  const esperados = new Map<string, Esperado>();
  for (const proposta of previsao.propostas) {
    if (esperados.has(proposta.encontroId)) return null;
    esperados.set(proposta.encontroId, { inicio: proposta.inicioProposto, fim: proposta.fimProposto, status: "PREVISTO" });
  }
  for (const preservado of previsao.preservados) {
    if (esperados.has(preservado.id)) return null;
    esperados.set(preservado.id, { inicio: preservado.inicio, fim: preservado.fim, status: preservado.status });
  }
  return esperados;
}

const mesmaAgenda = (encontros: readonly Encontro[], esperados: ReadonlyMap<string, Esperado>) =>
  esperados.size === encontros.length && encontros.every((encontro) => mesmoEncontro(esperados.get(encontro.id), encontro));

/**
 * Encadeia as alterações de quantidade aplicadas depois do replanejamento. Cada
 * elo precisa partir exatamente da agenda deixada pelo anterior; encontros
 * adicionados nascem sem id na fotografia e são reconhecidos pelo horário.
 * Com `desde`, só a agenda a partir desse instante é conferida (destinos).
 */
export function encadearAlteracoesQuantidade(inicial: ReadonlyMap<string, Esperado>, agenda: readonly Encontro[], alteracoes: readonly AlteracaoQuantidadeOferta[], aplicadaApos: Date, desde?: Date) {
  const noRecorte = (e: { inicio: string }) => !desde || new Date(e.inicio) >= desde;
  const encontros = agenda.filter((e) => !desde || e.inicio >= desde);
  let estado = new Map([...inicial].filter(([, e]) => noRecorte(e)));
  const elos: ElosQuantidade = [];
  const posteriores = alteracoes
    .filter((a) => a.decisao?.aprovada && a.aplicacao && a.decisao.estadoHash === a.estadoHash && a.aplicacao.estadoHash === a.estadoHash && a.aplicacao.aplicadaEm > aplicadaApos)
    .sort((a, b) => a.aplicacao!.aplicadaEm.getTime() - b.aplicacao!.aplicadaEm.getTime() || a.propostaId.localeCompare(b.propostaId));
  for (const alteracao of posteriores) {
    const impacto = ImpactoQuantidadeSchema.safeParse(alteracao.impactoSnapshot);
    if (!impacto.success) return null;
    const antes = new Map(impacto.data.agendaAntes.filter(noRecorte).flatMap((e) => e.id && estado.has(e.id) ? [[e.id, e] as const] : []));
    if (antes.size !== estado.size) return null;
    for (const [id, esperado] of estado) {
      const registrado = antes.get(id)!;
      if (registrado.inicio !== esperado.inicio || registrado.fim !== esperado.fim || !statusCoerente(esperado.status, registrado.status)) return null;
    }
    const depois = new Map<string, Esperado>();
    const agendaDepois = impacto.data.agendaDepois.filter(noRecorte);
    for (const e of agendaDepois) if (e.id && estado.has(e.id)) depois.set(e.id, { inicio: e.inicio, fim: e.fim, status: e.status });
    if (depois.size !== estado.size) return null;
    const livres = encontros.filter((e) => !depois.has(e.id));
    for (const adicionado of agendaDepois.filter((e) => e.id === null)) {
      const indice = livres.findIndex((e) => mesmoEncontro(adicionado, e));
      if (indice < 0) return null;
      depois.set(livres.splice(indice, 1)[0]!.id, { inicio: adicionado.inicio, fim: adicionado.fim, status: adicionado.status });
    }
    estado = depois;
    elos.push({ propostaId: alteracao.propostaId, decisaoId: alteracao.decisao!.id, aplicacaoId: alteracao.aplicacao!.id, estadoHash: alteracao.estadoHash });
  }
  return elos.length && mesmaAgenda(encontros, estado) ? elos : null;
}

/**
 * Uma grade publicada pode permanecer vinculada ao calendário anterior depois de
 * uma revisão conjunta. A cadeia só é aceita quando a aplicação aprovada da
 * versão vigente contém a própria turma e explica a agenda que está em leitura,
 * diretamente ou seguida de alterações de quantidade aprovadas e aplicadas.
 */
export function ancorarCalendarioOferta(input: {
  grade: { calendarioId: string; calendarioVersao: number };
  calendarioVigente: Calendario | null;
  turmaId: string;
  encontros: readonly Encontro[];
  alteracoesQuantidade?: readonly AlteracaoQuantidadeOferta[];
}): AncoraCalendarioOferta | null {
  const { grade, calendarioVigente, turmaId, encontros, alteracoesQuantidade = [] } = input;
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
    if (revisoesDaTurma.length !== 1 || !revisaoDaTurma?.previsao) continue;
    const esperados = agendaPrevista(revisaoDaTurma.previsao);
    if (!esperados) continue;
    const elos = mesmaAgenda(encontros, esperados) ? [] : decisao.aplicacao.aplicadaEm
      ? encadearAlteracoesQuantidade(esperados, encontros, alteracoesQuantidade, decisao.aplicacao.aplicadaEm) : null;
    if (!elos) continue;
    return {
      tipo: "REPLANEJAMENTO_APLICADO", calendarioId: calendarioVigente.id, calendarioVersao: calendarioVigente.versao,
      revisaoId: registro.id, decisaoId: decisao.id, aplicacaoId: decisao.aplicacao.id, estadoHash: registro.estadoHash,
      ...(elos.length ? { alteracoesQuantidade: elos } : {}),
    };
  }
  return null;
}
