import { describe, expect, it } from "vitest";
import { calcularAcertoMensalEncerramento } from "./encerramento-acerto";
const parcela = { contratoVersaoId: "v1", cobrancaId: "c1", moeda: "BRL", dataEfetiva: "2028-02-15", coberturaInicio: "2028-01-01", coberturaFim: "2028-01-31", diaEncerramento: "INCLUIR" as const, metodoDesconto: "ANTES_DO_PROPORCIONAL" as const, valorBase: "310", descontoValido: "0", recebido: "0" };
const entrada = { matriculaId: "m1", contratoVersaoId: "v1", moeda: "BRL", dataEfetiva: "2028-02-15", parcelas: [parcela], multa: { tipo: "SEM_PREVISAO" as const, contratoVersaoId: "v1", moeda: "BRL", motivo: "Sem cláusula de multa" } };
describe("prévia do acerto mensal", () => {
  it("preserva crédito separado de dívida de outro período", () => {
    const r = calcularAcertoMensalEncerramento({ ...entrada, parcelas: [parcela, { ...parcela, cobrancaId: "c2", coberturaInicio: "2028-03-01", coberturaFim: "2028-03-31", recebido: "310" }] });
    expect(r).toMatchObject({ saldoDevidoSemCompensarCreditos: "310.00", creditoApuradoSemUtilizacao: "310.00", totalServico: "310.00" });
  });
  it("rejeita duplicidade, sobreposição e moeda incompatível", () => {
    expect(() => calcularAcertoMensalEncerramento({ ...entrada, parcelas: [parcela, parcela] })).toThrow(/duplicada/);
    expect(() => calcularAcertoMensalEncerramento({ ...entrada, parcelas: [parcela, { ...parcela, cobrancaId: "c2" }] })).toThrow(/sobrepostos/);
    expect(() => calcularAcertoMensalEncerramento({ ...entrada, parcelas: [{ ...parcela, moeda: "USD" }] })).toThrow(/incompatível/);
  });
  it("soma multa uma vez, preservando a linha separada", () => {
    const r = calcularAcertoMensalEncerramento({ ...entrada, multa: { tipo: "VALOR_FIXO", contratoVersaoId: "v1", moeda: "BRL", clausulaId: "7", condicoesAplicacao: "Condição contratual", evidenciaAplicabilidade: "Conferência registrada", valor: "40" } });
    expect(r.saldoDevidoSemCompensarCreditos).toBe("350.00");
    expect(r.totalServico).toBe("310.00");
    expect(r.multa.valor).toBe("40.00");
  });
});
