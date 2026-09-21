import { describe, expect, it } from "vitest";
import { calcularParcelaEncerramento, ParcelaEncerramentoSchema } from "./encerramento-calculo";
const base = { contratoVersaoId: "contrato-v1", cobrancaId: "mensalidade", moeda: "BRL", coberturaInicio: "2028-04-01", coberturaFim: "2028-04-30", dataEfetiva: "2028-04-15", diaEncerramento: "INCLUIR" as const, metodoDesconto: "ANTES_DO_PROPORCIONAL" as const, valorBase: "500.00", descontoValido: "100.00", recebido: "0.00" };
describe("parcela do acerto de encerramento", () => {
  it("aplica os dois métodos contratuais sem duplicar desconto", () => {
    expect(calcularParcelaEncerramento(base).valorDevido).toBe("200.00");
    expect(calcularParcelaEncerramento({ ...base, metodoDesconto: "DEPOIS_DO_PROPORCIONAL" }).valorDevido).toBe("150.00");
  });
  it("usa dias reais bissextos e exclusão explícita do dia", () => {
    const r = calcularParcelaEncerramento({ ...base, coberturaInicio: "2028-02-01", coberturaFim: "2028-02-29", dataEfetiva: "2028-02-11", diaEncerramento: "EXCLUIR", valorBase: "290", descontoValido: "0", recebido: "120" });
    expect(r).toMatchObject({ diasPeriodo: 29, diasCobertos: 10, ultimoDiaCoberto: "2028-02-10", valorDevido: "100.00", saldoDevido: "0.00", creditoApurado: "20.00", recebido: "120" });
  });
  it("limita dias ao período e não transforma desconto em crédito fictício", () => {
    expect(calcularParcelaEncerramento({ ...base, dataEfetiva: "2028-03-31", metodoDesconto: "DEPOIS_DO_PROPORCIONAL" })).toMatchObject({ diasCobertos: 0, ultimoDiaCoberto: null, valorDevido: "0.00", creditoApurado: "0.00" });
    expect(calcularParcelaEncerramento({ ...base, dataEfetiva: "2028-05-20" })).toMatchObject({ diasCobertos: 30, valorDevido: "400.00", ultimoDiaCoberto: "2028-04-30" });
  });
  it("não presume regra contratual e recusa dados inconsistentes", () => {
    expect(ParcelaEncerramentoSchema.safeParse({ ...base, diaEncerramento: undefined }).success).toBe(false);
    expect(() => calcularParcelaEncerramento({ ...base, descontoValido: "501" })).toThrow();
    expect(() => calcularParcelaEncerramento({ ...base, coberturaFim: "2028-03-01" })).toThrow();
  });
});

it.each([0, 100, 300])("considera crédito já liquidado de %s separado de dinheiro no proporcional", (credito) => {
  const r = calcularParcelaEncerramento({ ...base, recebido: "50.00", creditoLiquidado: credito.toFixed(2) });
  expect(r.recebido).toBe("50.00");
  expect(r.saldoDevido).toBe(Math.max(0, 200 - 50 - credito).toFixed(2));
  expect(r.creditoApurado).toBe(Math.max(0, 50 + credito - 200).toFixed(2));
});
