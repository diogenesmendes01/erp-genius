import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canonizarFotografiaFinanceira, hashFotografiaFinanceira } from "./fotografia-financeira";

describe("fotografia financeira", () => {
  const base = { cobranca: { valor: new Prisma.Decimal("10"), data: new Date("2025-01-01T00:00:00.000Z"), detalhes: { documento: "A", moeda: "CRC" } }, recebimentos: [{ valor: new Prisma.Decimal("2.5"), forma: "PIX" }] };
  it("mantém o hash para a mesma estrutura com chaves reordenadas", () => {
    const reordenado = { recebimentos: [{ forma: "PIX", valor: new Prisma.Decimal("2.50") }], cobranca: { detalhes: { moeda: "CRC", documento: "A" }, data: new Date("2025-01-01T00:00:00.000Z"), valor: new Prisma.Decimal("10.00") } };
    expect(hashFotografiaFinanceira(reordenado)).toBe(hashFotografiaFinanceira(base));
  });
  it.each([
    ["campo interno", { ...base, cobranca: { ...base.cobranca, detalhes: { ...base.cobranca.detalhes, documento: "B" } } }],
    ["item do array", { ...base, recebimentos: [{ valor: new Prisma.Decimal(1), forma: "DINHEIRO" }, ...base.recebimentos] }],
    ["data", { ...base, cobranca: { ...base.cobranca, data: new Date("2025-01-02T00:00:00.000Z") } }],
    ["decimal", { ...base, cobranca: { ...base.cobranca, valor: new Prisma.Decimal("10.01") } }],
  ])("inclui alteração de %s", (_nome, alterado) => expect(hashFotografiaFinanceira(alterado)).not.toBe(hashFotografiaFinanceira(base)));
  it("distingue Decimals com precisão superior a duas casas", () => {
    expect(hashFotografiaFinanceira({ valor: new Prisma.Decimal("10.001") })).not.toBe(hashFotografiaFinanceira({ valor: new Prisma.Decimal("10.002") }));
  });
  it("preserva a ordem dos mesmos itens do array", () => {
    const itens = [{ id: "primeiro", valor: "10" }, { id: "segundo", valor: "20" }];
    expect(hashFotografiaFinanceira({ itens })).not.toBe(hashFotografiaFinanceira({ itens: [...itens].reverse() }));
  });
  it("não altera objetos, arrays, datas ou Decimals da origem", () => {
    const antes = { data: base.cobranca.data.toISOString(), decimal: base.cobranca.valor.toString(), array: [...base.recebimentos] };
    canonizarFotografiaFinanceira(base);
    expect(base.cobranca.data.toISOString()).toBe(antes.data); expect(base.cobranca.valor.toString()).toBe(antes.decimal); expect(base.recebimentos).toEqual(antes.array);
  });
  it.each([NaN, Infinity, new Prisma.Decimal("NaN"), new Prisma.Decimal("Infinity"), new Date("invalida"), undefined, new Map([["valor", 1]])])("rejeita valor não serializável %p", (valor) => {
    expect(() => canonizarFotografiaFinanceira(valor)).toThrow();
  });
});
