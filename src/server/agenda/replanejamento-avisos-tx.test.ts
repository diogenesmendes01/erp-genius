import { describe, expect, it, vi } from "vitest";
const { criarAvisos } = vi.hoisted(() => ({ criarAvisos: vi.fn() }));
vi.mock("@/server/comunicacoes-agenda/avisos", () => ({ criarAvisosAlteracaoAgendaTx: criarAvisos }));
import { agruparAvisosReplanejamento, criarAvisosReplanejamentoConjuntoTx } from "./replanejamento-avisos-tx";

const horario = { encontroId: "e1", inicioAnterior: "2099-10-01T19:00:00.000Z", fimAnterior: "2099-10-01T20:00:00.000Z", inicioProposto: "2099-10-08T19:00:00.000Z", fimProposto: "2099-10-08T20:00:00.000Z" };
const encontro = { id: "e1", turmaId: "t1", matriculaId: null, inicio: new Date(horario.inicioProposto), fim: new Date(horario.fimProposto) };
const snapshot = { calendarioId: "cal1", conferidoEm: "2099-09-01T00:00:00.000Z", pendencias: [], revisoes: [{ turmaId: "t1", codigo: "T1", fusoOrigem: "UTC", pendencias: [], previsao: { previsaoTermino: null, propostas: [{ ...horario, alterado: true, motivoAjuste: null }], preservados: [] } }], recursos: { internos: [], externos: [], indisponibilidades: [], reservas: [], semDocenteApto: [] }, particulares: [], recuperacoes: [] };

describe("agruparAvisosReplanejamento", () => {
  it("inclui alocação original ou nova, registra a origem e não inclui estranhos", () => {
    expect(agruparAvisosReplanejamento([horario], [encontro], [
      { matriculaId: "historica", turmaId: "t1", criadoEm: new Date("2099-09-01T00:00:00Z"), encerradaEm: new Date("2099-10-02T00:00:00Z"), ativa: false, provenienciaVinculo: null, inicioVigencia: null, fimVigencia: null },
      { matriculaId: "nova", turmaId: "t1", criadoEm: new Date("2099-10-02T00:00:00Z"), encerradaEm: null, ativa: true, provenienciaVinculo: null, inicioVigencia: null, fimVigencia: null },
      { matriculaId: "continua", turmaId: "t1", criadoEm: new Date("2099-09-01T00:00:00Z"), encerradaEm: null, ativa: true, provenienciaVinculo: null, inicioVigencia: null, fimVigencia: null },
      { matriculaId: "fora", turmaId: "t1", criadoEm: new Date("2099-10-09T00:00:00Z"), encerradaEm: null, ativa: true, provenienciaVinculo: null, inicioVigencia: null, fimVigencia: null },
      { matriculaId: "outra-turma", turmaId: "t2", criadoEm: new Date("2099-09-01T00:00:00Z"), encerradaEm: null, ativa: true, provenienciaVinculo: null, inicioVigencia: null, fimVigencia: null },
    ])).toEqual([
      { matriculaId: "continua", encontrosIds: ["e1"], origem: "AMBOS" },
      { matriculaId: "historica", encontrosIds: ["e1"], origem: "HORARIO_ORIGINAL" },
      { matriculaId: "nova", encontrosIds: ["e1"], origem: "HORARIO_PROPOSTO" },
    ]);
  });
  it("usa a vigência acadêmica migrada, não a data técnica de importação", () => {
    expect(agruparAvisosReplanejamento([horario], [encontro], [
      { matriculaId: "migrada", turmaId: "t1", criadoEm: new Date("2100-01-01T00:00:00Z"), encerradaEm: null, ativa: true, provenienciaVinculo: "MIGRACAO", inicioVigencia: new Date("2099-09-01T00:00:00Z"), fimVigencia: new Date("2099-10-02T00:00:00Z") },
    ])).toEqual([{ matriculaId: "migrada", encontrosIds: ["e1"], origem: "HORARIO_ORIGINAL" }]);
  });
  it("não projeta encontro particular", () => {
    expect(agruparAvisosReplanejamento([horario], [{ ...encontro, matriculaId: "m-particular" }], [{ matriculaId: "m1", turmaId: "t1", criadoEm: new Date("2099-09-01T00:00:00Z"), encerradaEm: null, ativa: true, provenienciaVinculo: null, inicioVigencia: null, fimVigencia: null }])).toEqual([]);
  });

  it("revalida a fonte e chama o helper uma vez por matrícula agrupada", async () => {
    criarAvisos.mockResolvedValue([]);
    const tx = {
      evento: { findUnique: vi.fn().mockResolvedValue({ agregadoTipo: "ConfiguracaoOperacional", agregadoId: "escola", tipo: "ReplanejamentoConjuntoAplicado", payload: { aprovada: true, revisaoId: "r1", decisaoId: "d1", encontrosIds: ["e1"], horarios: [horario] } }) },
      rascunhoReplanejamento: { findUnique: vi.fn().mockResolvedValue({ snapshot, decisaoConjunta: { id: "d1", aprovada: true, aplicacao: { id: "a1" } } }) },
      encontroAgenda: { findMany: vi.fn().mockResolvedValue([encontro]) },
      alocacaoTurma: { findMany: vi.fn().mockResolvedValue([
        { matriculaId: "historica", turmaId: "t1", criadoEm: new Date("2099-09-01T00:00:00Z"), encerradaEm: new Date("2099-10-02T00:00:00Z"), ativa: false, provenienciaVinculo: null, inicioVigencia: null, fimVigencia: null },
        { matriculaId: "nova", turmaId: "t1", criadoEm: new Date("2099-10-02T00:00:00Z"), encerradaEm: null, ativa: true, provenienciaVinculo: null, inicioVigencia: null, fimVigencia: null },
      ]) },
    };
    await expect(criarAvisosReplanejamentoConjuntoTx(tx as never, { eventoId: "evento-1", rascunhoId: "r1" })).resolves.toEqual([
      { matriculaId: "historica", encontrosIds: ["e1"], origem: "HORARIO_ORIGINAL" },
      { matriculaId: "nova", encontrosIds: ["e1"], origem: "HORARIO_PROPOSTO" },
    ]);
    expect(criarAvisos).toHaveBeenCalledTimes(2);
    expect(criarAvisos).toHaveBeenCalledWith(tx, { eventoId: "evento-1", matriculaId: "historica", encontrosIds: ["e1"] });
    expect(criarAvisos).toHaveBeenCalledWith(tx, { eventoId: "evento-1", matriculaId: "nova", encontrosIds: ["e1"] });
  });

  it("recusa horário anterior forjado antes de consultar alocações", async () => {
    const tx = {
      evento: { findUnique: vi.fn().mockResolvedValue({ agregadoTipo: "ConfiguracaoOperacional", agregadoId: "escola", tipo: "ReplanejamentoConjuntoAplicado", payload: { aprovada: true, revisaoId: "r1", decisaoId: "d1", encontrosIds: ["e1"], horarios: [{ ...horario, inicioAnterior: "2099-10-02T19:00:00.000Z" }] } }) },
      rascunhoReplanejamento: { findUnique: vi.fn().mockResolvedValue({ snapshot, decisaoConjunta: { id: "d1", aprovada: true, aplicacao: { id: "a1" } } }) },
      encontroAgenda: { findMany: vi.fn() }, alocacaoTurma: { findMany: vi.fn() },
    };
    await expect(criarAvisosReplanejamentoConjuntoTx(tx as never, { eventoId: "evento-forjado", rascunhoId: "r1" })).rejects.toThrow("Fotografia da revisão");
    expect(tx.encontroAgenda.findMany).not.toHaveBeenCalled();
    expect(tx.alocacaoTurma.findMany).not.toHaveBeenCalled();
  });
});
