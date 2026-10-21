import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { recebimentoPreservavel } from "./recebimento-preservavel";

const d = (valor: number) => new Prisma.Decimal(valor);
describe("liquidação preservável na pausa e retomada", () => {
  it("preserva crédito integral sem inventar dinheiro recebido", () => {
    expect(recebimentoPreservavel({ status: "PAGO", valorNegociado: d(100), valorRecebido: null, valorLiquidadoCredito: d(100), saldo: d(0) })).toBe(true);
  });
  it("confere saldo misto e recusa saldo que ignora o crédito", () => {
    const c = { status: "PENDENTE", valorNegociado: d(100), valorRecebido: d(20), valorLiquidadoCredito: d(30), saldo: d(50) };
    expect(recebimentoPreservavel(c)).toBe(true);
    expect(recebimentoPreservavel({ ...c, saldo: d(80) })).toBe(false);
    expect(recebimentoPreservavel({ ...c, valorLiquidadoCredito: d(-30) })).toBe(false);
  });
  it("não presume quitação sem saldo ou origem registrada", () => {
    expect(recebimentoPreservavel({ status: "PAGO", valorNegociado: d(100), valorRecebido: null, saldo: d(0) })).toBe(false);
    expect(recebimentoPreservavel({ status: "PAGO", valorNegociado: d(100), valorRecebido: d(100), saldo: null })).toBe(false);
  });
});

it("preserva compensação por serviço sem presumir recebimento em dinheiro", () => {
  const parcial = { status: "PENDENTE", valorNegociado: d(100), valorRecebido: null, valorCompensadoPermuta: d(60), saldo: d(40) };
  expect(recebimentoPreservavel(parcial)).toBe(true);
  expect(recebimentoPreservavel({ ...parcial, saldo: d(100) })).toBe(false);
  expect(recebimentoPreservavel({ ...parcial, status: "PAGO", valorCompensadoPermuta: d(100), saldo: d(0) })).toBe(true);
  expect(recebimentoPreservavel({ ...parcial, valorCompensadoPermuta: d(-60) })).toBe(false);
});
