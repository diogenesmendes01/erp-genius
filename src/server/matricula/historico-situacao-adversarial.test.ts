import { describe, expect, it } from "vitest";
import { situacaoMatriculaNaAula, type HistoricoSituacaoMatricula } from "./historico-situacao";

const fatosBase = [
  { ordem: 1, tipo: "ATIVACAO", efetivoEm: new Date("2025-01-01T06:00:00.000Z") },
  { ordem: 2, tipo: "PAUSA", efetivoEm: new Date("2025-03-01T06:00:00.000Z") },
  { ordem: 3, tipo: "ATIVACAO", efetivoEm: new Date("2025-04-01T06:00:00.000Z") },
] as const;

const historico = (status: string = "ATIVA"): HistoricoSituacaoMatricula => ({
  status, ativadaEm: null, pausas: [], retomadas: [], fatosMigracao: fatosBase,
});

describe("contradições entre fatos migrados e operação posterior", () => {
  it("não retoma depois de cancelamento terminal comprovado", () => {
    const h = historico("CANCELADA");
    h.fatosMigracao = [...fatosBase, { ordem: 4, tipo: "CANCELAMENTO", efetivoEm: new Date("2025-05-01T06:00:00.000Z") }];
    h.retomadas = [{ aplicadaEm: new Date("2025-06-02T12:00:00.000Z"), snapshot: { retorno: "2025-06-01", fusoInstitucional: "America/Costa_Rica" } }];
    expect(situacaoMatriculaNaAula(h, new Date("2025-06-03T12:00:00.000Z"))).toBe("A_CONFERIR");
  });

  it("não aceita pausa operacional anterior ao último fato importado", () => {
    const h = historico("PAUSADA");
    h.pausas = [{ aplicadaEm: new Date("2025-04-03T12:00:00.000Z"), snapshot: { dataEfetiva: "2025-03-15", fusoInstitucional: "America/Costa_Rica" } }];
    expect(situacaoMatriculaNaAula(h, new Date("2025-04-04T12:00:00.000Z"))).toBe("A_CONFERIR");
  });

  it("exige que o estado atual mantenha o tipo terminal comprovado", () => {
    const cancelada = historico("ENCERRADA");
    cancelada.fatosMigracao = [...fatosBase, { ordem: 4, tipo: "CANCELAMENTO", efetivoEm: new Date("2025-05-01T06:00:00.000Z") }];
    expect(situacaoMatriculaNaAula(cancelada, new Date("2025-05-02T12:00:00.000Z"))).toBe("A_CONFERIR");
    const encerrada = historico("CANCELADA");
    encerrada.fatosMigracao = [...fatosBase, { ordem: 4, tipo: "ENCERRAMENTO", efetivoEm: new Date("2025-05-01T06:00:00.000Z") }];
    expect(situacaoMatriculaNaAula(encerrada, new Date("2025-05-02T12:00:00.000Z"))).toBe("A_CONFERIR");
  });
});

