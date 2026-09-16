import { describe, expect, it } from "vitest";
import { apurarFrequenciaNivel } from "./frequencia";

const contexto = { matriculaId: "m1", nivelId: "A1", apuradaEm: "2026-09-10T12:00:00Z", minimoPercentual: "75" };
function aula(aulaId: string, participacao: "PRESENTE" | "FALTA" | "IMPEDIDO_POR_RESTRICAO" | "PENDENTE" = "PRESENTE") {
  return { aulaId, matriculaId: "m1", nivelId: "A1", fim: "2026-09-01T12:00:00Z", situacao: "MINISTRADA" as const, participacao };
}
const reposicao = (id: string, aulaOriginalId: string) => ({ id, aulaOriginalId, matriculaId: "m1", modalidade: "GRAVACAO" as const, validadaEm: "2026-09-05T12:00:00Z" });

describe("frequência contratual por encontros", () => {
  it("conserva falta e impedimento originais, regulariza uma vez e usa data da validação", () => {
    const r = apurarFrequenciaNivel({ ...contexto, aulas: [aula("a"), { ...aula("b", "FALTA"), reposicoes: [reposicao("r1", "b"), reposicao("r2", "b")] },
      { ...aula("c", "IMPEDIDO_POR_RESTRICAO"), reposicoes: [{ ...reposicao("r3", "c"), modalidade: "PARTICULAR" }] }, aula("d", "IMPEDIDO_POR_RESTRICAO")] });
    expect(r).toMatchObject({ base: 4, presencas: 1, regularizadas: 2, impedimentos: 1, contabilizadas: 3, atendeMinimo: true });
    expect(r.memoria.find(a => a.aulaId === "b")).toMatchObject({ participacaoOriginal: "FALTA", resultado: "REPOSTA", repostaEm: "2026-09-05T12:00:00Z" });
  });
  it("não aprova frequência vazia nem arredonda 2/3 para superar 66,67%", () => {
    expect(apurarFrequenciaNivel({ ...contexto, aulas: [] }).atendeMinimo).toBeNull();
    const aulas = [aula("a"), aula("b"), aula("c", "FALTA")];
    expect(apurarFrequenciaNivel({ ...contexto, minimoPercentual: "66.67", aulas })).toMatchObject({ atendeMinimo: false, percentual: { numerador: "200", denominador: "3" } });
    expect(apurarFrequenciaNivel({ ...contexto, minimoPercentual: "66.66", aulas }).atendeMinimo).toBe(true);
  });
  it("aula passada prevista e chamada incompleta deixam resultado pendente", () => {
    const r = apurarFrequenciaNivel({ ...contexto, aulas: [{ ...aula("a"), situacao: "PREVISTA" }, aula("b", "PENDENTE")] });
    expect(r.atendeMinimo).toBeNull();
    expect(r.pendencias).toEqual([{ aulaId: "a", motivo: "CONCLUSAO_DA_AULA" }, { aulaId: "b", motivo: "CHAMADA" }]);
  });
  it("exclui cancelada e futura da base; entrega ainda não validada não regulariza falta", () => {
    const r = apurarFrequenciaNivel({ ...contexto, aulas: [{ ...aula("a"), situacao: "CANCELADA" },
      { ...aula("b"), situacao: "PREVISTA", fim: "2026-10-01T12:00:00Z" },
      { ...aula("c", "FALTA"), reposicoes: [{ ...reposicao("r", "c"), validadaEm: null }] }] });
    expect(r).toMatchObject({ base: 1, faltas: 1, regularizadas: 0, atendeMinimo: false, pendencias: [] });
  });
  it("recusa aulas de outro contrato/nível e duplicação da aula original", () => {
    for (const alteracao of [{ matriculaId: "m2" }, { nivelId: "A2" }]) {
      expect(() => apurarFrequenciaNivel({ ...contexto, aulas: [{ ...aula("a"), ...alteracao }] })).toThrow("outro contrato ou nível");
    }
    expect(() => apurarFrequenciaNivel({ ...contexto, aulas: [aula("a"), aula("a")] })).toThrow("duplicada");
  });
  it("recusa reposição de outra aula, outro contrato ou com validação futura", () => {
    for (const alteracao of [{ aulaOriginalId: "b" }, { matriculaId: "m2" }, { validadaEm: "2026-10-01T12:00:00Z" }]) {
      expect(() => apurarFrequenciaNivel({ ...contexto, aulas: [{ ...aula("a", "FALTA"), reposicoes: [{ ...reposicao("r", "a"), ...alteracao }] }] })).toThrow();
    }
  });
  it("não aceita regularização sem ausência conferida ou aula concluída", () => {
    for (const origem of [aula("a", "PENDENTE"), { ...aula("a", "FALTA"), situacao: "PREVISTA" as const }]) {
      expect(() => apurarFrequenciaNivel({ ...contexto, aulas: [{ ...origem, reposicoes: [reposicao("r", "a")] }] })).toThrow();
    }
  });
  it("recusa mínimo inválido e aula ministrada futura", () => {
    expect(() => apurarFrequenciaNivel({ ...contexto, minimoPercentual: "101", aulas: [] })).toThrow();
    expect(() => apurarFrequenciaNivel({ ...contexto, aulas: [{ ...aula("a"), fim: "2026-10-01T12:00:00Z" }] })).toThrow("futuro");
  });
});
