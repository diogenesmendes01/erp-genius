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
