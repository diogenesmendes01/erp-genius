import { describe, expect, it } from "vitest";
import { calcularObrigacaoDesistenciaContratual } from "./desistencia-acerto-contratual-calculo";

const base = { diaEncerramento: "EXCLUIR", metodoDesconto: "ANTES_DO_PROPORCIONAL", condicoesDescontos: "Conforme contrato", multa: { tipo: "SEM_PREVISAO", motivo: "Sem multa" } };
describe("Q165 cálculo contratual da desistência", () => {
  it("recusa versão contratual sem fórmula estruturada", () => expect(() => calcularObrigacaoDesistenciaContratual(base, { valorNegociado: 100, valorRecebido: 100, valorLiquidadoCredito: 0 })).toThrow("regra estruturada"));
  it("apura saldo ou crédito somente pela fórmula contratada", () => {
    const regras = { ...base, acertoDesistenciaPreparacao: { tipo: "PERCENTUAL_VALOR_NEGOCIADO" as const, percentual: "25", clausulaId: "7.2", condicoesAplicacao: "Desistência antes da ativação" } };
    expect(calcularObrigacaoDesistenciaContratual(regras, { valorNegociado: 200, valorRecebido: 80, valorLiquidadoCredito: 0 })).toMatchObject({ devido: expect.objectContaining({}), saldoDevido: expect.objectContaining({}), creditoApurado: expect.objectContaining({}), clausulaId: "7.2" });
    const r = calcularObrigacaoDesistenciaContratual(regras, { valorNegociado: 200, valorRecebido: 80, valorLiquidadoCredito: 0 });
    expect([r.devido.toFixed(2), r.saldoDevido.toFixed(2), r.creditoApurado.toFixed(2)]).toEqual(["50.00", "0.00", "30.00"]);
  });
});
