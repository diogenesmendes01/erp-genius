import { describe, expect, it } from "vitest";
import { situacaoMatriculaNaAula, type HistoricoSituacaoMatricula } from "./historico-situacao";
const base = (): HistoricoSituacaoMatricula => ({ status: "ATIVA", ativadaEm: new Date("2026-09-01T12:00:00Z"),
  pausas: [{ aplicadaEm: new Date("2026-09-16T12:00:00Z"), snapshot: { dataEfetiva: "2026-09-15", fusoInstitucional: "America/Costa_Rica" } }],
  retomadas: [{ aplicadaEm: new Date("2026-10-02T12:00:00Z"), snapshot: { retorno: "2026-10-01", fusoInstitucional: "America/Costa_Rica" } }],
});
describe("situação histórica do contrato", () => {
  it("consulta antes, durante e após pausa pela data efetiva, não pela data de lançamento", () => {
    const h = base();
    expect(situacaoMatriculaNaAula(h, new Date("2026-09-14T12:00:00Z"))).toBe("ATIVA");
    expect(situacaoMatriculaNaAula(h, new Date("2026-09-15T12:00:00Z"))).toBe("PAUSADA");
    expect(situacaoMatriculaNaAula(h, new Date("2026-10-01T12:00:00Z"))).toBe("ATIVA");
  });
  it("respeita meia-noite institucional e permite histórico de matrícula ainda pausada", () => {
    const h = base(); h.retomadas = []; h.status = "PAUSADA";
    expect(situacaoMatriculaNaAula(h, new Date("2026-09-15T05:59:59Z"))).toBe("ATIVA");
    expect(situacaoMatriculaNaAula(h, new Date("2026-09-15T06:00:00Z"))).toBe("PAUSADA");
  });
  it("não inventa ativação ou movimento ausente", () => {
    const h = base();
    expect(situacaoMatriculaNaAula(h, new Date("2026-08-31T12:00:00Z"))).toBe("NAO_ATIVADA");
    expect(situacaoMatriculaNaAula({ ...h, ativadaEm: null }, new Date())).toBe("A_CONFERIR");
    expect(situacaoMatriculaNaAula({ ...h, pausas: [] }, new Date())).toBe("A_CONFERIR");
    expect(situacaoMatriculaNaAula({ ...h, status: "ENCERRADA" }, new Date())).toBe("A_CONFERIR");
  });
  it("recusa snapshots sem fuso, sequência contraditória e diferença entre histórico e estado atual", () => {
    const h = base();
    expect(situacaoMatriculaNaAula({ ...h, pausas: [{ aplicadaEm: new Date(), snapshot: { dataEfetiva: "2026-09-15" } }] }, new Date())).toBe("A_CONFERIR");
    expect(situacaoMatriculaNaAula({ ...h, pausas: [...h.pausas, ...h.pausas] }, new Date())).toBe("A_CONFERIR");
    expect(situacaoMatriculaNaAula({ ...h, status: "PAUSADA" }, new Date())).toBe("A_CONFERIR");
  });
});

it("usa o limite exclusivo comprovado do encerramento sem perder as aulas anteriores", () => {
  const h: HistoricoSituacaoMatricula = { ...base(), status: "ENCERRADA", encerramento: { statusAnterior: "ATIVA", limiteVinculo: new Date("2026-10-16T06:00:00Z") } };
  expect(situacaoMatriculaNaAula(h, new Date("2026-09-14T12:00:00Z"))).toBe("ATIVA");
  expect(situacaoMatriculaNaAula(h, new Date("2026-09-16T12:00:00Z"))).toBe("PAUSADA");
  expect(situacaoMatriculaNaAula(h, new Date("2026-10-16T05:59:59Z"))).toBe("ATIVA");
  expect(situacaoMatriculaNaAula(h, new Date("2026-10-16T06:00:00Z"))).toBe("ENCERRADA");
  expect(situacaoMatriculaNaAula({ ...h, status: "ATIVA" }, new Date("2026-10-15T12:00:00Z"))).toBe("A_CONFERIR");
  expect(situacaoMatriculaNaAula({ ...h, encerramento: { statusAnterior: "ATIVA", limiteVinculo: new Date("inválida") } }, new Date())).toBe("A_CONFERIR");
});

describe("situação comprovada da matrícula migrada", () => {
  const migrada = (): HistoricoSituacaoMatricula => ({ status: "ATIVA", ativadaEm: null, pausas: [], retomadas: [], fatosMigracao: [
    { ordem: 1, tipo: "ATIVACAO", efetivoEm: new Date("2025-01-01T06:00:00Z") },
    { ordem: 2, tipo: "PAUSA", efetivoEm: new Date("2025-03-01T06:00:00Z") },
    { ordem: 3, tipo: "ATIVACAO", efetivoEm: new Date("2025-04-01T06:00:00Z") },
  ] });
  it("reconstrói a situação sem preencher ativadaEm comercial", () => {
    const h = migrada();
    expect(situacaoMatriculaNaAula(h, new Date("2024-12-31T23:00:00Z"))).toBe("NAO_ATIVADA");
    expect(situacaoMatriculaNaAula(h, new Date("2025-02-01T06:00:00Z"))).toBe("ATIVA");
    expect(situacaoMatriculaNaAula(h, new Date("2025-03-01T06:00:00Z"))).toBe("PAUSADA");
    expect(situacaoMatriculaNaAula(h, new Date("2025-04-01T06:00:00Z"))).toBe("ATIVA");
    expect(h.ativadaEm).toBeNull();
  });
  it("combina fatos importados com pausa e encerramento operacionais posteriores", () => {
    const h = migrada(); h.status = "ENCERRADA";
    h.pausas = [{ aplicadaEm: new Date("2026-01-03T12:00:00Z"), snapshot: { dataEfetiva: "2026-01-02", fusoInstitucional: "America/Costa_Rica" } }];
    h.encerramento = { statusAnterior: "PAUSADA", limiteVinculo: new Date("2026-02-01T06:00:00Z") };
    expect(situacaoMatriculaNaAula(h, new Date("2026-01-02T05:59:59Z"))).toBe("ATIVA");
    expect(situacaoMatriculaNaAula(h, new Date("2026-01-02T06:00:00Z"))).toBe("PAUSADA");
    expect(situacaoMatriculaNaAula(h, new Date("2026-02-01T06:00:00Z"))).toBe("ENCERRADA");
  });
  it("preserva o histórico anterior a cancelamento comprovado", () => {
    const h = migrada(); h.status = "CANCELADA";
    h.fatosMigracao = [...h.fatosMigracao!, { ordem: 4, tipo: "CANCELAMENTO", efetivoEm: new Date("2025-05-01T06:00:00Z") }];
    expect(situacaoMatriculaNaAula(h, new Date("2025-04-15T06:00:00Z"))).toBe("ATIVA");
    expect(situacaoMatriculaNaAula(h, new Date("2025-05-01T06:00:00Z"))).toBe("CANCELADA");
  });
  it("exige conferência para cadeia contraditória ou divergente do estado atual", () => {
    const h = migrada();
    expect(situacaoMatriculaNaAula({ ...h, status: "PAUSADA" }, new Date())).toBe("A_CONFERIR");
    expect(situacaoMatriculaNaAula({ ...h, fatosMigracao: h.fatosMigracao!.slice(1) }, new Date())).toBe("A_CONFERIR");
    expect(situacaoMatriculaNaAula({ ...h, ativadaEm: new Date("2026-01-01") }, new Date())).toBe("A_CONFERIR");
  });
});