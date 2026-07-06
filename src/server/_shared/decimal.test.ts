import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { numero, numeroOuNull, semDecimais } from "./decimal";

const D = (v: string | number) => new Prisma.Decimal(v);

describe("numero / numeroOuNull", () => {
  it("converte Decimal para number e preserva number", () => {
    expect(numero(D("150.75"))).toBe(150.75);
    expect(numero(42)).toBe(42);
  });

  it("numeroOuNull trata null/undefined e preserva zero", () => {
    expect(numeroOuNull(null)).toBeNull();
    expect(numeroOuNull(undefined)).toBeNull();
    expect(numeroOuNull(D(0))).toBe(0);
  });
});

describe("semDecimais", () => {
  it("converte Decimal em qualquer profundidade, preservando Date e o resto", () => {
    const criadoEm = new Date("2026-07-02T12:00:00Z");
    const ficha = {
      nome: "Ana",
      criadoEm,
      matriculas: [
        {
          moeda: "CRC",
          cobrancas: [{ valorNegociado: D("85000"), valorRecebido: null, saldo: D("85000.5") }],
        },
      ],
    };
    const plano = semDecimais(ficha);
    expect(plano.matriculas[0].cobrancas[0].valorNegociado).toBe(85000);
    expect(plano.matriculas[0].cobrancas[0].saldo).toBe(85000.5);
    expect(plano.matriculas[0].cobrancas[0].valorRecebido).toBeNull();
    expect(plano.criadoEm).toBe(criadoEm); // Date intacto (RSC serializa Date)
    expect(plano.nome).toBe("Ana");
  });

  it("não muta o objeto original", () => {
    const original = { valor: D("10.5") };
    semDecimais(original);
    expect(Prisma.Decimal.isDecimal(original.valor)).toBe(true);
  });
});
