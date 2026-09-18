import { describe, expect, it } from "vitest";
import { calcularObrigacaoDesistenciaContratual } from "./desistencia-acerto-contratual-calculo";

const base = { diaEncerramento: "EXCLUIR", metodoDesconto: "ANTES_DO_PROPORCIONAL", condicoesDescontos: "Conforme contrato", multa: { tipo: "SEM_PREVISAO", motivo: "Sem multa" } };
describe("Q165 cálculo contratual da desistência", () => {
  it("apura somente o excedente ainda não convertido em crédito", () => {
    const regras = { ...base, acertoDesistenciaPreparacao: { tipo: "VALOR_FIXO", valor: "50", clausulaId: "7.6", condicoesAplicacao: { momento: "ANTES_ATIVACAO", unidade: "POR_COBRANCA", alcance: { tipo: "TODAS_COBRANCAS_MATRICULA" } } } };
    const cobranca = { id: "taxa", tipo: "MATRICULA", valorNegociado: 100, valorRecebido: 80, valorLiquidadoCredito: 20, valorCreditoJaApurado: 30 };
    const r = calcularObrigacaoDesistenciaContratual(regras, cobranca);
    expect([r.creditoApurado.toFixed(2), r.creditoAnterior.toFixed(2), r.liquidacaoLiquida.toFixed(2)]).toEqual(["20.00", "30.00", "70.00"]);
    const repetido = calcularObrigacaoDesistenciaContratual(regras, { ...cobranca, valorCreditoJaApurado: 50 });
    expect(repetido.creditoApurado.toFixed(2)).toBe("0.00");
    expect(cobranca.valorRecebido).toBe(80);
    const saldo = calcularObrigacaoDesistenciaContratual(regras, { ...cobranca, valorCreditoJaApurado: 70 });
    expect([saldo.saldoDevido.toFixed(2), saldo.creditoApurado.toFixed(2)]).toEqual(["20.00", "0.00"]);
    for (const valorCreditoJaApurado of [-1, 101]) {
      expect(() => calcularObrigacaoDesistenciaContratual(regras, { ...cobranca, valorCreditoJaApurado })).toThrow("créditos já apurados");
    }
  });
  it("recusa versão contratual sem fórmula estruturada", () => expect(() => calcularObrigacaoDesistenciaContratual(base, { id: "taxa", tipo: "MATRICULA", valorNegociado: 100, valorRecebido: 100, valorLiquidadoCredito: 0 })).toThrow("regra estruturada"));
  it("apura saldo ou crédito somente pela fórmula contratada", () => {
    const regras = { ...base, acertoDesistenciaPreparacao: { tipo: "PERCENTUAL_VALOR_NEGOCIADO" as const, percentual: "25", clausulaId: "7.2", condicoesAplicacao: { momento: "ANTES_ATIVACAO" as const, unidade: "POR_COBRANCA" as const, alcance: { tipo: "TODAS_COBRANCAS_MATRICULA" as const } } } };
    const cobranca = { id: "taxa", tipo: "MATRICULA", valorNegociado: 200, valorRecebido: 80, valorLiquidadoCredito: 0 };
    expect(calcularObrigacaoDesistenciaContratual(regras, cobranca)).toMatchObject({ devido: expect.objectContaining({}), saldoDevido: expect.objectContaining({}), creditoApurado: expect.objectContaining({}), clausulaId: "7.2" });
    const r = calcularObrigacaoDesistenciaContratual(regras, cobranca);
    expect([r.devido.toFixed(2), r.saldoDevido.toFixed(2), r.creditoApurado.toFixed(2)]).toEqual(["50.00", "0.00", "30.00"]);
  });
  it("não repete valor fixo fora do alcance e rateia total contratado uma única vez", () => {
    const regraTotal = { ...base, acertoDesistenciaPreparacao: { tipo: "VALOR_FIXO" as const, valor: "100", clausulaId: "7.3", condicoesAplicacao: { momento: "ANTES_ATIVACAO" as const, unidade: "TOTAL_CONTRATACAO" as const, cobrancaIds: ["taxa", "mensal"], rateio: [{ cobrancaId: "taxa", percentual: "25" }, { cobrancaId: "mensal", percentual: "75" }] } } };
    const todas = [{ id: "taxa", tipo: "MATRICULA", valorNegociado: 200 }, { id: "mensal", tipo: "MENSALIDADE", valorNegociado: 300 }];
    expect(calcularObrigacaoDesistenciaContratual(regraTotal, { ...todas[0], valorRecebido: 25, valorLiquidadoCredito: 0 }, todas).devido.toFixed(2)).toBe("25.00");
    expect(calcularObrigacaoDesistenciaContratual(regraTotal, { ...todas[1], valorRecebido: 75, valorLiquidadoCredito: 0 }, todas).devido.toFixed(2)).toBe("75.00");
  });
  it("fecha centavos do total e recusa fontes ausentes, extras ou duplicadas", () => {
    const regra = { ...base, acertoDesistenciaPreparacao: { tipo: "VALOR_FIXO" as const, valor: "0.05", clausulaId: "7.3", condicoesAplicacao: { momento: "ANTES_ATIVACAO" as const, unidade: "TOTAL_CONTRATACAO" as const, cobrancaIds: ["taxa", "mensal"], rateio: [{ cobrancaId: "taxa", percentual: "50" }, { cobrancaId: "mensal", percentual: "50" }] } } };
    const fontes = [{ id: "taxa", tipo: "MATRICULA", valorNegociado: 200 }, { id: "mensal", tipo: "MENSALIDADE", valorNegociado: 300 }];
    const taxa = calcularObrigacaoDesistenciaContratual(regra, { ...fontes[0], valorRecebido: 0, valorLiquidadoCredito: 0 }, fontes);
    const mensal = calcularObrigacaoDesistenciaContratual(regra, { ...fontes[1], valorRecebido: 0, valorLiquidadoCredito: 0 }, fontes);
    expect(taxa.devido.plus(mensal.devido).toFixed(2)).toBe("0.05");
    expect(() => calcularObrigacaoDesistenciaContratual(regra, { ...fontes[0], valorRecebido: 0, valorLiquidadoCredito: 0 }, [fontes[0]])).toThrow("conjunto");
    expect(() => calcularObrigacaoDesistenciaContratual(regra, { ...fontes[0], valorRecebido: 0, valorLiquidadoCredito: 0 }, [...fontes, fontes[0]])).toThrow("conjunto");
  });
  it("não entrega resíduo para quota zero", () => {
    const regra = { ...base, acertoDesistenciaPreparacao: { tipo: "VALOR_FIXO" as const, valor: "0.01", clausulaId: "7.5", condicoesAplicacao: { momento: "ANTES_ATIVACAO" as const, unidade: "TOTAL_CONTRATACAO" as const, cobrancaIds: ["a", "b", "c"], rateio: [{ cobrancaId: "a", percentual: "0" }, { cobrancaId: "b", percentual: "50" }, { cobrancaId: "c", percentual: "50" }] } } };
    const fontes = ["a", "b", "c"].map(id => ({ id, tipo: "MATRICULA", valorNegociado: 1 }));
    expect(calcularObrigacaoDesistenciaContratual(regra, { ...fontes[0], valorRecebido: 0, valorLiquidadoCredito: 0 }, fontes).devido.toFixed(2)).toBe("0.00");
  });
  it("preserva crédito já liquidado e bloqueia excedente de permuta sem destinação", () => {
    const regras = { ...base, acertoDesistenciaPreparacao: { tipo: "VALOR_FIXO" as const, valor: "50", clausulaId: "7.4", condicoesAplicacao: { momento: "ANTES_ATIVACAO" as const, unidade: "POR_COBRANCA" as const, alcance: { tipo: "COBRANCAS_IDENTIFICADAS" as const, cobrancaIds: ["taxa"] } } } };
    expect(calcularObrigacaoDesistenciaContratual(regras, { id: "taxa", tipo: "MATRICULA", valorNegociado: 100, valorRecebido: 20, valorLiquidadoCredito: 40 }).creditoApurado.toFixed(2)).toBe("10.00");
    expect(() => calcularObrigacaoDesistenciaContratual(regras, { id: "taxa", tipo: "MATRICULA", valorNegociado: 100, valorRecebido: 50, valorLiquidadoCredito: 0, valorCompensadoPermuta: 1 })).toThrow("permuta");
  });
});
