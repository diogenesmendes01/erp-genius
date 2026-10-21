import { describe, expect, it } from "vitest";
import { ancorarCalendarioOferta } from "./cadeia-calendario-oferta";

const aulas = [
  { id: "aula-ministrada", inicio: new Date("2026-10-01T12:00:00.000Z"), fim: new Date("2026-10-01T13:00:00.000Z"), status: "MINISTRADO" },
  { id: "aula-futura", inicio: new Date("2026-10-08T12:00:00.000Z"), fim: new Date("2026-10-08T13:00:00.000Z"), status: "PREVISTO" },
];
const snapshot = {
  calendarioId: "cal-novo", conferidoEm: "2026-09-20T12:00:00.000Z", pendencias: [],
  revisoes: [{ turmaId: "turma", codigo: "T-1", fusoOrigem: "UTC", pendencias: [], previsao: {
    previsaoTermino: "2026-10-08T13:00:00.000Z",
    propostas: [{ encontroId: "aula-futura", inicioAnterior: "2026-10-08T12:00:00.000Z", fimAnterior: "2026-10-08T13:00:00.000Z", inicioProposto: "2026-10-08T12:00:00.000Z", fimProposto: "2026-10-08T13:00:00.000Z", alterado: false }],
    preservados: [{ id: "aula-ministrada", inicio: "2026-10-01T12:00:00.000Z", fim: "2026-10-01T13:00:00.000Z", status: "MINISTRADO" }],
  } }],
  recursos: { internos: [], externos: [], indisponibilidades: [], semDocenteApto: [] }, particulares: [],
};
function calendario(ajustes: Record<string, unknown> = {}) {
  return {
    id: "cal-novo", versao: 2,
    replanejamentos: [{ id: "revisao", estadoHash: "h".repeat(64), snapshot, decisaoConjunta: { id: "decisao", aprovada: true, estadoHash: "h".repeat(64), aplicacao: { id: "aplicacao", estadoHash: "h".repeat(64) } } }],
    ...ajustes,
  };
}
const entrada = () => ({ grade: { calendarioId: "cal-antigo", calendarioVersao: 1 }, calendarioVigente: calendario(), turmaId: "turma", encontros: aulas });

describe("ancorarCalendarioOferta", () => {
  it("aceita a cadeia aplicada que preserva aula ministrada e agenda futura", () => {
    expect(ancorarCalendarioOferta(entrada())).toEqual(expect.objectContaining({
      tipo: "REPLANEJAMENTO_APLICADO", revisaoId: "revisao", decisaoId: "decisao", aplicacaoId: "aplicacao",
    }));
  });

  it.each([
    ["sem aplicação", calendario({ replanejamentos: [{ ...calendario().replanejamentos[0], decisaoConjunta: { ...calendario().replanejamentos[0].decisaoConjunta, aplicacao: null } }] })],
    ["cadeia divergente", calendario({ replanejamentos: [{ ...calendario().replanejamentos[0], decisaoConjunta: { ...calendario().replanejamentos[0].decisaoConjunta, estadoHash: "x".repeat(64) } }] })],
    ["agenda cancelada", calendario()],
    ["agenda removida", calendario()],
  ])("exige confirmação com %s", (_nome, atual) => {
    const encontros = _nome === "agenda cancelada"
      ? [{ ...aulas[0], status: "CANCELADO" }, aulas[1]]
      : _nome === "agenda removida" ? [aulas[0]] : aulas;
    expect(ancorarCalendarioOferta({ ...entrada(), calendarioVigente: atual, encontros })).toBeNull();
  });

  it("mantém a âncora direta para a grade ligada ao calendário vigente", () => {
    expect(ancorarCalendarioOferta({ ...entrada(), grade: { calendarioId: "cal-novo", calendarioVersao: 2 } })).toEqual({
      tipo: "GRADE_PUBLICADA", calendarioId: "cal-novo", calendarioVersao: 2,
    });
  });

  it("aceita uma revisão posterior legítima e invalida somente a fotografia anterior", () => {
    const snapshotPosterior = structuredClone(snapshot);
    snapshotPosterior.calendarioId = "cal-posterior";
    snapshotPosterior.revisoes[0]!.previsao!.propostas[0]!.inicioProposto = "2026-10-08T14:00:00.000Z";
    snapshotPosterior.revisoes[0]!.previsao!.propostas[0]!.fimProposto = "2026-10-08T15:00:00.000Z";
    const encontrosPosteriores = [aulas[0], { ...aulas[1], inicio: new Date("2026-10-08T14:00:00.000Z"), fim: new Date("2026-10-08T15:00:00.000Z") }];
    const ancora = ancorarCalendarioOferta({
      ...entrada(), calendarioVigente: calendario({ id: "cal-posterior", versao: 3, replanejamentos: [{
        ...calendario().replanejamentos[0], id: "revisao-posterior", snapshot: snapshotPosterior,
      }] }), encontros: encontrosPosteriores,
    });
    expect(ancora).toMatchObject({ tipo: "REPLANEJAMENTO_APLICADO", calendarioId: "cal-posterior", revisaoId: "revisao-posterior" });
    expect(ancorarCalendarioOferta({ ...entrada(), calendarioVigente: calendario({ id: "cal-posterior", versao: 3, replanejamentos: [{ ...calendario().replanejamentos[0], snapshot: snapshotPosterior }] }), encontros: aulas })).toBeNull();
  });
  it("aceita a evolução PREVISTO→MINISTRADO após a fotografia, mas não outro status", () => {
    const ministrada = [aulas[0], { ...aulas[1], status: "MINISTRADO" }];
    expect(ancorarCalendarioOferta({ ...entrada(), encontros: ministrada })).toMatchObject({ tipo: "REPLANEJAMENTO_APLICADO", revisaoId: "revisao" });
    expect(ancorarCalendarioOferta({ ...entrada(), encontros: [aulas[0], { ...aulas[1], status: "NAO_REALIZADO" }] })).toBeNull();
    expect(ancorarCalendarioOferta({ ...entrada(), encontros: [{ ...aulas[0], status: "PREVISTO" }, aulas[1]] })).toBeNull();
  });

  describe("alteração de quantidade aplicada depois do replanejamento", () => {
    const aplicadoEm = new Date("2026-09-21T00:00:00.000Z");
    const comData = () => calendario({ replanejamentos: [{ ...calendario().replanejamentos[0], decisaoConjunta: { ...calendario().replanejamentos[0].decisaoConjunta, aplicacao: { id: "aplicacao", estadoHash: "h".repeat(64), aplicadaEm: aplicadoEm } } }] });
    const iso = (e: typeof aulas[number]) => ({ id: e.id as string | null, inicio: e.inicio.toISOString(), fim: e.fim.toISOString(), status: e.status });
    const nova = { id: "aula-nova", inicio: new Date("2026-10-15T12:00:00.000Z"), fim: new Date("2026-10-15T13:00:00.000Z"), status: "PREVISTO" };
    const alteracao = (ajustes: Record<string, unknown> = {}) => ({
      propostaId: "quantidade", estadoHash: "q".repeat(64),
      decisao: { id: "decisao-q", aprovada: true, estadoHash: "q".repeat(64) },
      aplicacao: { id: "aplicacao-q", estadoHash: "q".repeat(64), aplicadaEm: new Date("2026-09-25T00:00:00.000Z") },
      impactoSnapshot: { agendaAntes: aulas.map(iso), agendaDepois: [...aulas.map(iso), { ...iso(nova), id: null }] },
      ...ajustes,
    });
    const ancorar = (alteracoes: unknown[], encontros = [...aulas, nova]) => ancorarCalendarioOferta({ ...entrada(), calendarioVigente: comData(), encontros, alteracoesQuantidade: alteracoes as never });

    it("encadeia a aplicação aprovada e guarda o elo na âncora", () => {
      expect(ancorar([alteracao()])).toMatchObject({ tipo: "REPLANEJAMENTO_APLICADO", revisaoId: "revisao",
        alteracoesQuantidade: [{ propostaId: "quantidade", decisaoId: "decisao-q", aplicacaoId: "aplicacao-q", estadoHash: "q".repeat(64) }] });
    });

    it("reconhece cancelamento e remarcação registrados pela alteração", () => {
      const depois = [iso(aulas[0]), { ...iso(aulas[1]), status: "CANCELADO" }];
      expect(ancorar([alteracao({ impactoSnapshot: { agendaAntes: aulas.map(iso), agendaDepois: depois } })], [aulas[0], { ...aulas[1], status: "CANCELADO" }])).not.toBeNull();
    });

    it.each([
      ["sem aplicação", alteracao({ aplicacao: null })],
      ["rejeitada", alteracao({ decisao: { id: "decisao-q", aprovada: false, estadoHash: "q".repeat(64) } })],
      ["hash divergente", alteracao({ estadoHash: "x".repeat(64) })],
      ["anterior ao replanejamento", alteracao({ aplicacao: { id: "aplicacao-q", estadoHash: "q".repeat(64), aplicadaEm: new Date("2026-09-20T00:00:00.000Z") } })],
      ["partida divergente da agenda replanejada", alteracao({ impactoSnapshot: { agendaAntes: [iso(aulas[0])], agendaDepois: [...aulas.map(iso), { ...iso(nova), id: null }] } })],
      ["fotografia ilegível", alteracao({ impactoSnapshot: { agendaAntes: "x" } })],
    ])("exige confirmação com alteração %s", (_nome, item) => {
      expect(ancorar([item])).toBeNull();
    });

    it("não aceita encontro que nenhuma alteração explica", () => {
      const intruso = { ...nova, id: "intruso", inicio: new Date("2026-10-22T12:00:00.000Z"), fim: new Date("2026-10-22T13:00:00.000Z") };
      expect(ancorar([alteracao()], [...aulas, nova, intruso])).toBeNull();
      expect(ancorar([], [...aulas, nova])).toBeNull();
    });
  });
});
