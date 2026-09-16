import { describe, expect, it } from "vitest";
import { Papel, StatusCobranca, StatusMatricula } from "@prisma/client";
import { acimaDaAlcada, calcularPoliticaComissao, descontoAcumulado, dinheiro, exigirConferenciaIndependente, saldoAtual, validarEstadoAtivacao, pagamentoConfirmado } from "./regras";
import { exigeAprovacaoComponente } from "./politica";

describe("contratos financeiros aprovados D01/D06/D07", () => {
  it("separa crédito aprovado do dinheiro recebido na quitação", () => {
    expect(saldoAtual("100.00", "30.00", "20.00").toFixed(2)).toBe("50.00");
    expect(saldoAtual("100.00", null, "100.00").isZero()).toBe(true);
    expect(() => saldoAtual(100, 0, -1)).toThrow();
    const c = { status: StatusCobranca.PAGO, valorNegociado: 100, valorRecebido: null, valorLiquidadoCredito: 100, pagoEm: new Date() };
    expect(pagamentoConfirmado(c)).toBe(true);
    expect(pagamentoConfirmado({ ...c, valorLiquidadoCredito: 99 })).toBe(false);
    expect(pagamentoConfirmado({ ...c, status: StatusCobranca.PENDENTE })).toBe(false);
  });
  it("preserva centavos sem erro de soma binária", () => {
    expect(dinheiro("0.1").plus(dinheiro("0.2")).toNumber()).toBe(0.3);
    expect(dinheiro("10.005").toNumber()).toBe(10.01);
  });
  it("saldo desconta todos os pagamentos parciais e não fica negativo", () => {
    expect(saldoAtual(90, 40).toNumber()).toBe(50);
    expect(saldoAtual(30, 40).toNumber()).toBe(0);
  });
  it("duas reduções sucessivas continuam contra a referência original", () => {
    expect(descontoAcumulado(100, 90).toNumber()).toBe(10);
    expect(acimaDaAlcada(100, 90, 6)).toBe(true);
  });
  it("a alçada de mensalidade não cobre a taxa e vice-versa", () => {
    const limites = { limiteDescontoTaxaPct: dinheiro(5), limiteDescontoMensalidadePct: dinheiro(20) };
    expect(exigeAprovacaoComponente(limites, "MATRICULA", 100, 90)).toBe(true);
    expect(exigeAprovacaoComponente(limites, "MENSALIDADE", 100, 90)).toBe(false);
    expect(exigeAprovacaoComponente(limites, "MENSALIDADE", 100, 70)).toBe(true);
  });
  it("ausência de configuração não libera qualquer desconto", () => {
    expect(acimaDaAlcada(100, 99, null)).toBe(true);
    expect(acimaDaAlcada(100, 100, null)).toBe(false);
    expect(descontoAcumulado(0, 0).isFinite()).toBe(true);
  });
  it.each(Object.values(Papel))("o acúmulo do papel %s não simula outra pessoa", () => {
    expect(() => exigirConferenciaIndependente("mesmo", "mesmo")).toThrow(/outra pessoa/);
    expect(() => exigirConferenciaIndependente("autor", "conferente")).not.toThrow();
  });
  it("comissão percentual usa a taxa e arredonda dinheiro", () => {
    expect(calcularPoliticaComissao({ tipo: "PERCENTUAL", base: "TAXA_MATRICULA", percentual: "12.5", valorFixo: null, moeda: "BRL" }, "99.99", "BRL").toNumber()).toBe(12.5);
  });
  it("comissão fixa não muda quando a taxa recebe desconto", () => {
    const p = { tipo: "VALOR_FIXO" as const, base: "TAXA_MATRICULA", percentual: null, valorFixo: 30, moeda: "BRL" };
    expect(calcularPoliticaComissao(p, 100, "BRL").toNumber()).toBe(30);
    expect(calcularPoliticaComissao(p, 1, "BRL").toNumber()).toBe(30);
    expect(() => calcularPoliticaComissao(p, 1, "USD")).toThrow(/moeda/);
  });
  it("não inventa base, valor ou tipo de comissão", () => {
    expect(() => calcularPoliticaComissao({ tipo: "PERCENTUAL", base: "MENSALIDADES", percentual: 10, valorFixo: null, moeda: "BRL" }, 100, "BRL")).toThrow(/Base/);
    expect(() => calcularPoliticaComissao({ tipo: "PERCENTUAL", base: "TAXA_MATRICULA", percentual: null, valorFixo: null, moeda: "BRL" }, 100, "BRL")).toThrow(/inválida/);
  });
  it.each([StatusMatricula.CANCELADA, StatusMatricula.ENCERRADA, StatusMatricula.ATIVA])("não reativa matrícula %s pelo formulário de ativação", (status) => {
    expect(() => validarEstadoAtivacao(status, StatusCobranca.PAGO)).toThrow();
  });
  it("taxa cancelada não é evidência de quitação", () => {
    expect(() => validarEstadoAtivacao(StatusMatricula.AGUARDANDO, StatusCobranca.CANCELADA)).toThrow(/cancelada/);
  });
});
