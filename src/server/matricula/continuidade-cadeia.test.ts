import { describe, expect, it } from "vitest";
import {
  conferirCadeiaContinuidade,
  type EntradaConferirCadeiaContinuidade,
} from "./continuidade-cadeia";

const mensalidade = (id: string, inicio: string | null, fim: string | null): EntradaConferirCadeiaContinuidade["mensalidades"][number] => ({
  id,
  coberturaInicio: inicio,
  coberturaFim: fim,
  status: "PENDENTE",
  suspensaPorItemPausaId: null,
  regularizacaoIntegral: null,
});

const conferir = (...mensalidades: EntradaConferirCadeiaContinuidade["mensalidades"][number][]) =>
  conferirCadeiaContinuidade({ mensalidades });

describe("conferirCadeiaContinuidade", () => {
  it("seleciona a última cobertura regular sem emitir cobrança", () => {
    expect(conferir(
      mensalidade("jan", "2026-01-01", "2026-01-31"),
      { ...mensalidade("fev", "2026-02-01", "2026-02-28"), status: "PAGO" },
      { ...mensalidade("mar", "2026-03-01", "2026-03-31"), status: "ATRASADO" },
    )).toEqual({ estado: "CONFERIDA", ultima: { id: "mar", inicio: "2026-03-01", fim: "2026-03-31" } });
  });

  it("usa a cobertura atual de uma regularização futura aplicada", () => {
    expect(conferir(
      mensalidade("jan", "2026-01-01", "2026-01-31"),
      { ...mensalidade("futura", "2026-02-01", "2026-02-28"), regularizacaoIntegral: "COBERTURA_FUTURA" },
    )).toEqual({ estado: "CONFERIDA", ultima: { id: "futura", inicio: "2026-02-01", fim: "2026-02-28" } });
  });

  it("aceita cancelada antiga inteiramente superada por nova âncora regular", () => {
    expect(conferir(
      { ...mensalidade("cancelada", "2026-01-01", "2026-01-31"), status: "CANCELADA" },
      mensalidade("regular", "2026-02-01", "2026-02-28"),
    )).toEqual({ estado: "CONFERIDA", ultima: { id: "regular", inicio: "2026-02-01", fim: "2026-02-28" } });
  });

  it("bloqueia cancelada futura ou sobreposta em vez de pulá-la", () => {
    expect(conferir(
      mensalidade("regular", "2026-02-01", "2026-02-28"),
      { ...mensalidade("cancelada-futura", "2026-03-01", "2026-03-31"), status: "CANCELADA" },
    )).toMatchObject({ estado: "A_CONFERIR", motivo: expect.stringMatching(/cancelada.*cancelada-futura/i) });

    expect(conferir(
      mensalidade("regular", "2026-02-01", "2026-02-28"),
      { ...mensalidade("cancelada-sobreposta", "2026-02-20", "2026-03-10"), status: "CANCELADA" },
    )).toMatchObject({ estado: "A_CONFERIR", motivo: expect.stringMatching(/cancelada-sobreposta/) });
  });

  it("bloqueia crédito aplicado na fronteira da última âncora", () => {
    expect(conferir(
      mensalidade("regular", "2026-02-01", "2026-02-28"),
      { ...mensalidade("credito", "2026-02-28", "2026-03-15"), regularizacaoIntegral: "CREDITO" },
    )).toMatchObject({ estado: "A_CONFERIR", motivo: expect.stringMatching(/credito/) });
  });

  it("exige conferência para suspensão remanescente", () => {
    expect(conferir({
      ...mensalidade("suspensa", "2026-02-01", "2026-02-28"),
      suspensaPorItemPausaId: "pausa-1",
    })).toMatchObject({ estado: "A_CONFERIR", motivo: expect.stringMatching(/Suspensão/) });
  });

  it("não presume retomada de cancelada suspensa mesmo havendo cobertura regular posterior", () => {
    expect(conferir(
      { ...mensalidade("suspensa-antiga", "2026-01-01", "2026-01-31"), status: "CANCELADA", suspensaPorItemPausaId: "pausa-1" },
      mensalidade("regular", "2026-02-01", "2026-02-28"),
    )).toMatchObject({ estado: "A_CONFERIR", motivo: expect.stringMatching(/Suspensão/) });
  });

  it("não aceita datas fora do intervalo persistível", () => {
    expect(() => conferir(mensalidade("antiga", "0000-01-01", "0000-01-31"))).toThrow();
    expect(() => conferir(mensalidade("invalida", "2026-02-29", "2026-03-31"))).toThrow();
  });

  it("exige conferência para id repetido, cobertura ausente ou invertida", () => {
    expect(conferir(
      mensalidade("repetida", "2026-01-01", "2026-01-31"),
      mensalidade("repetida", "2026-02-01", "2026-02-28"),
    )).toMatchObject({ estado: "A_CONFERIR", motivo: expect.stringMatching(/repetida/) });
    expect(conferir(mensalidade("sem-cobertura", null, null))).toMatchObject({ estado: "A_CONFERIR", motivo: expect.stringMatching(/sem cobertura/) });
    expect(conferir(mensalidade("invertida", "2026-02-28", "2026-02-01"))).toMatchObject({ estado: "A_CONFERIR", motivo: expect.stringMatching(/invertida/) });
  });

  it("recusa sobreposição entre coberturas elegíveis", () => {
    expect(conferir(
      mensalidade("a", "2026-02-01", "2026-02-28"),
      mensalidade("b", "2026-02-20", "2026-03-20"),
    )).toMatchObject({ estado: "A_CONFERIR", motivo: expect.stringMatching(/sobrepostas/) });
  });

  it("valida o contrato de entrada antes de conferir a cadeia", () => {
    expect(() => conferirCadeiaContinuidade({
      mensalidades: [{ ...mensalidade("invalida", "2026-02-01", "2026-02-28"), status: "EMITIDA" }],
    } as unknown as EntradaConferirCadeiaContinuidade)).toThrow();
  });
});
