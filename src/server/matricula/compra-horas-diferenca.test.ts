import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { parcelasDiferenca, separarDiferencaCompra } from "./compra-horas-diferenca";

const d = (v: string) => new Prisma.Decimal(v);
const aplicacao = (anterior: string, novo: string) => ({ valorAnterior: d(anterior), valorNovo: d(novo) });

// Referência de 150/h, negociado de 125/h e 120 minutos: emissão com valor original 300 e cobrança de 250 (desconto 50).
describe("parcelas da diferença gravada na compra de horas (B1 da #264)", () => {
  it("sem aplicação de aditivo a diferença inteira é desconto original", () => {
    expect(separarDiferencaCompra(d("50"), [])).toEqual({ valor: "50.00", desconto: "50.00", reducaoAditivo: "0.00" });
  });

  it("aditivo só de vencimento (250 → 250) não gera redução: só o desconto de 50", () => {
    expect(separarDiferencaCompra(d("50"), [aplicacao("250", "250")])).toEqual({ valor: "50.00", desconto: "50.00", reducaoAditivo: "0.00" });
  });

  it("aditivo que aumenta (250 → 280): desconto de 20, sem redução", () => {
    expect(separarDiferencaCompra(d("20"), [aplicacao("250", "280")])).toEqual({ valor: "20.00", desconto: "20.00", reducaoAditivo: "0.00" });
  });

  it("aditivo que reduz (250 → 200): desconto de 50 e redução de 50", () => {
    expect(separarDiferencaCompra(d("100"), [aplicacao("250", "200")])).toEqual({ valor: "100.00", desconto: "50.00", reducaoAditivo: "50.00" });
  });

  it("referência igual ao negociado: a redução é toda a diferença", () => {
    expect(separarDiferencaCompra(d("50"), [aplicacao("250", "200")])).toEqual({ valor: "50.00", desconto: "0.00", reducaoAditivo: "50.00" });
  });

  it("várias aplicações: 1ª anterior contra a última nova, limitada à diferença gravada", () => {
    expect(separarDiferencaCompra(d("100"), [aplicacao("250", "280"), aplicacao("280", "200")])).toEqual({ valor: "100.00", desconto: "50.00", reducaoAditivo: "50.00" });
    expect(separarDiferencaCompra(d("30"), [aplicacao("250", "200")])).toEqual({ valor: "30.00", desconto: "0.00", reducaoAditivo: "30.00" });
    expect(separarDiferencaCompra(d("0"), [aplicacao("250", "200")])).toEqual({ valor: "0.00", desconto: "0.00", reducaoAditivo: "0.00" });
  });

  it("exibe cada parcela positiva; sem nenhuma, mantém o desconto original", () => {
    expect(parcelasDiferenca({ desconto: "50.00", reducaoAditivo: "50.00" })).toEqual({ desconto: true, reducao: true });
    expect(parcelasDiferenca({ desconto: "0.00", reducaoAditivo: "50.00" })).toEqual({ desconto: false, reducao: true });
    expect(parcelasDiferenca({ desconto: "0.00", reducaoAditivo: "0.00" })).toEqual({ desconto: true, reducao: false });
  });
});
