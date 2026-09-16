import { describe, expect, it } from "vitest";
import { resolverPeriodoFechamentoHoras } from "./fechamento-horas-periodo";

const base = { referencia: { referencia: "MES_CIVIL" as const }, dataNoPeriodo: "2024-02-15",
  fuso: "America/Sao_Paulo", vencimento: "2024-03-10", clausula: "Fechamento mensal conforme contrato." };

describe("período do fechamento por hora", () => {
  it("inclui fevereiro bissexto e mantém vencimento separado da apuração", () => {
    expect(resolverPeriodoFechamentoHoras(base)).toMatchObject({ inicio: "2024-02-01", fim: "2024-02-29", dias: 29,
      inicioInstante: "2024-02-01T03:00:00.000Z", fimExclusivo: "2024-03-01T03:00:00.000Z", vencimento: "2024-03-10" });
  });
  it("respeita ciclo ancorado no dia 31 sem sobrepor o mês seguinte", () => {
    const referencia = { referencia: "CICLO_MATRICULA" as const, dataReferencia: "2024-01-31" };
    const anterior = resolverPeriodoFechamentoHoras({ ...base, referencia, dataNoPeriodo: "2024-02-28" });
    const seguinte = resolverPeriodoFechamentoHoras({ ...base, referencia, dataNoPeriodo: "2024-02-29" });
    expect(anterior).toMatchObject({ inicio: "2024-01-31", fim: "2024-02-28" });
    expect(seguinte).toMatchObject({ inicio: "2024-02-29", fim: "2024-03-30" });
    expect(anterior.fimExclusivo).toBe(seguinte.inicioInstante);
  });
  it("converte cada limite no fuso contratual, inclusive quando muda o horário de verão", () => {
    expect(resolverPeriodoFechamentoHoras({ ...base, fuso: "America/New_York", dataNoPeriodo: "2024-03-15" }))
      .toMatchObject({ inicioInstante: "2024-03-01T05:00:00.000Z", fimExclusivo: "2024-04-01T04:00:00.000Z", dias: 31 });
  });
});
