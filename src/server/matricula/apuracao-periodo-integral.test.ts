import { describe, expect, it } from "vitest";
import { apurarRegularizacaoPeriodoIntegral } from "./apuracao-periodo-integral";

const entrada = () => ({
  cobrancaId: "c1",
  matriculaId: "m1",
  moeda: "BRL",
  valorOriginal: "120.00",
  valorNegociado: "100.00",
  valorRecebido: "40.00",
  valorLiquidadoCredito: "10.00",
  saldoRegistrado: "50.00",
  recebimentos: [{ id: "r1", valor: "40.00", moeda: "BRL" }],
  cobertura: { inicio: "2026-02-01", fim: "2026-02-03" },
  diasConfirmados: ["2026-02-01", "2026-02-02", "2026-02-03"],
  escolha: "CREDITO" as const,
});

describe("apurarRegularizacaoPeriodoIntegral", () => {
  it("separa saldo desobrigado dos créditos que precisam voltar", () => {
    expect(apurarRegularizacaoPeriodoIntegral(entrada())).toMatchObject({
      escolha: "CREDITO",
      saldoADesobrigar: "50.00",
      creditoPorRecebimentos: "40.00",
      creditoPorLiquidacaoPrevia: "10.00",
      creditoAConstituir: "50.00",
    });
  });

  it("mantém a obrigação e os valores quando a escolha é cobertura futura", () => {
    const dados = { ...entrada(), escolha: "COBERTURA_FUTURA" as const };

    expect(apurarRegularizacaoPeriodoIntegral(dados)).toMatchObject({
      escolha: "COBERTURA_FUTURA",
      saldoAConservar: "50.00",
      transferenciaCoberturaPendente: true,
      valores: { valorOriginal: "120.00", valorNegociado: "100.00" },
    });
  });

  it("ignora duplicados de dias sem deixá-los completar uma cobertura incompleta", () => {
    const dados = entrada();
    dados.diasConfirmados = ["2026-02-01", "2026-02-01", "2026-02-02"];

    expect(() => apurarRegularizacaoPeriodoIntegral(dados)).toThrow(/todos os dias/i);
  });

  it("recusa dia fora da cobertura e moedas divergentes", () => {
    const fora = entrada();
    fora.diasConfirmados = ["2026-02-01", "2026-02-02", "2026-02-04"];
    expect(() => apurarRegularizacaoPeriodoIntegral(fora)).toThrow(/todos os dias/i);

    const moeda = entrada();
    moeda.recebimentos[0].moeda = "USD";
    expect(() => apurarRegularizacaoPeriodoIntegral(moeda)).toThrow(/moeda/i);
  });

  it("reconcilia recebimentos e saldo sem arredondar valores inválidos", () => {
    const soma = entrada();
    soma.recebimentos[0].valor = "39.99";
    expect(() => apurarRegularizacaoPeriodoIntegral(soma)).toThrow(/soma dos recebimentos/i);

    const saldo = entrada();
    saldo.saldoRegistrado = "49.99";
    expect(() => apurarRegularizacaoPeriodoIntegral(saldo)).toThrow(/saldo registrado/i);

    const preciso = entrada();
    preciso.valorRecebido = "40.001";
    expect(() => apurarRegularizacaoPeriodoIntegral(preciso)).toThrow(/decimal/i);
  });
});
