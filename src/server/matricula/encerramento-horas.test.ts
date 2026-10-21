import { expect, it } from "vitest";
import { calcularSaldoHorasEncerramento, SaldoHorasEncerramentoSchema } from "./encerramento-horas";
import type { z } from "zod";
const entrada = (): z.input<typeof SaldoHorasEncerramentoSchema> => ({ matriculaId: "m1", moeda: "BRL", compras: [{ compraId: "compra1", matriculaId: "m1", moeda: "BRL", contratoVersaoId: "contrato1", recebimentoReferencia: "r1", evidenciaCondicoes: "Condições da compra original", minutosComprados: 180, minutosReservados: 0, valorOriginal: "360", descontoOriginal: "60", valorPagoAlocado: "300", consumos: [], liquidacoesAnteriores: [] }] });
it("não apura crédito enquanto houver reserva não resolvida", () => {
  const d = entrada(); d.compras[0].minutosReservados = 60;
  expect(() => calcularSaldoHorasEncerramento(d)).toThrow(/reservas/);
});
it("usa o preço líquido original e frações de hora, preservando a origem", () => {
  const d = entrada(); d.compras[0].consumos.push({ id: "aula1", minutos: 75, motivo: "AULA_REALIZADA", evidencia: "Diário conferido" });
  const antes = structuredClone(d), r = calcularSaldoHorasEncerramento(d);
  expect(r.creditoApurado).toBe("175.00"); expect(r.compras[0].minutosPendentes).toBe(105);
  expect(r).toMatchObject({ multaIncluida: false, efetivado: false, exigeAprovacaoIndependente: true }); expect(d).toEqual(antes);
});
it("desconta falta e cancelamento tardio cobráveis sem criar notas ou presença", () => {
  const d = entrada(); d.compras[0].consumos = [{ id: "f1", minutos: 60, motivo: "FALTA_COBRAVEL", evidencia: "Condições conferidas" }, { id: "c1", minutos: 60, motivo: "CANCELAMENTO_TARDIO_COBRAVEL", evidencia: "Prazo contratual conferido" }];
  expect(calcularSaldoHorasEncerramento(d).creditoApurado).toBe("100.00");
});
it("não duplica liquidação anterior e conserva os centavos do valor original", () => {
  const d = entrada(); Object.assign(d.compras[0], { minutosComprados: 3, valorOriginal: "1", descontoOriginal: "0", valorPagoAlocado: "1", liquidacoesAnteriores: [{ id: "l1", minutos: 1, valor: "0.33", referenciaAcerto: "acerto1" }] });
  expect(calcularSaldoHorasEncerramento(d).creditoApurado).toBe("0.67");
});
it("recusa destinação duplicada, excesso de consumo e outra matrícula", () => {
  const d = entrada(); d.compras[0].consumos = [{ id: "a1", minutos: 181, motivo: "AULA_REALIZADA", evidencia: "Diário conferido" }];
  expect(() => calcularSaldoHorasEncerramento(d)).toThrow(/excedem/);
  d.compras[0].consumos[0].minutos = 60; d.compras[0].consumos.push({ ...d.compras[0].consumos[0] });
  expect(() => calcularSaldoHorasEncerramento(d)).toThrow(/repetida/);
  d.compras[0].consumos = []; d.compras[0].matriculaId = "outra";
  expect(() => calcularSaldoHorasEncerramento(d)).toThrow(/outra matrícula/);
});
it("bloqueia saldo financeiro incompatível e pagamento parcial não conciliado", () => {
  const d = entrada(); d.compras[0].valorPagoAlocado = "100";
  expect(() => calcularSaldoHorasEncerramento(d)).toThrow(/Concilie/);
  d.compras[0].valorPagoAlocado = "300"; d.compras[0].liquidacoesAnteriores = [{ id: "l1", minutos: 180, valor: "250", referenciaAcerto: "acerto1" }];
  expect(() => calcularSaldoHorasEncerramento(d)).toThrow(/divergem/);
});
it("liquidação integral anterior não gera crédito novo", () => {
  const d = entrada(); d.compras[0].liquidacoesAnteriores = [{ id: "l1", minutos: 180, valor: "300", referenciaAcerto: "acerto1" }];
  expect(calcularSaldoHorasEncerramento(d).creditoApurado).toBe("0.00");
});
