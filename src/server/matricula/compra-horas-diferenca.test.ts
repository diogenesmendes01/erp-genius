import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { diferencaValorCompra, origemDiferencaCompra } from "./compra-horas-diferenca";

const d = (v: string) => new Prisma.Decimal(v);
const comAditivo = { preparacao: { preparacaoId: "p1", minutosContratados: 120, aplicacaoAdiantamentoAditivoId: "aplicacao1" }, valorReferenciaCobranca: "250" };

describe("origem da diferença gravada na compra de horas (C2 da #261)", () => {
  it("aditivo que reduz o adiantamento é redução contratual, não desconto", () => {
    expect(diferencaValorCompra(comAditivo, d("50"))).toEqual({ origem: "REDUCAO_ADITIVO", valor: "50.00", rotulo: "Redução do adiantamento por aditivo" });
  });

  it("sem aplicação de aditivo a diferença continua sendo desconto original", () => {
    expect(diferencaValorCompra({ preparacao: { preparacaoId: "p1", minutosContratados: 120 } }, d("60"))).toEqual({ origem: "DESCONTO", valor: "60.00", rotulo: "Desconto original" });
    expect(origemDiferencaCompra({ fixture: "legada" }, d("60"))).toBe("DESCONTO");
    expect(origemDiferencaCompra(null, d("60"))).toBe("DESCONTO");
  });

  it("aditivo que aumenta ou mantém o valor não gera redução a rotular", () => {
    expect(diferencaValorCompra(comAditivo, d("0"))).toEqual({ origem: "DESCONTO", valor: "0.00", rotulo: "Desconto original" });
  });

  it("identificador de aplicação vazio não é aceito como aditivo", () => {
    expect(origemDiferencaCompra({ preparacao: { aplicacaoAdiantamentoAditivoId: "" } }, d("50"))).toBe("DESCONTO");
  });
});
