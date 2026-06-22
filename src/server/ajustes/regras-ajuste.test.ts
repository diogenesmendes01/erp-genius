import { describe, it, expect } from "vitest";
import { TipoAjuste } from "@prisma/client";
import {
  ehAumento,
  aumentoPermitido,
  validarDirecaoAjuste,
  descontoPercentual,
  precisaAprovacaoDesconto,
} from "@/server/_shared";

describe("ehAumento / aumentoPermitido", () => {
  it("detecta aumento quando valorPara > valorDe", () => {
    expect(ehAumento(100, 120)).toBe(true);
    expect(ehAumento(100, 100)).toBe(false);
    expect(ehAumento(100, 80)).toBe(false);
  });

  it("só ALTERACAO_VALOR pode aumentar", () => {
    expect(aumentoPermitido(TipoAjuste.ALTERACAO_VALOR)).toBe(true);
    expect(aumentoPermitido(TipoAjuste.DESCONTO)).toBe(false);
    expect(aumentoPermitido(TipoAjuste.BOLSA)).toBe(false);
    expect(aumentoPermitido(TipoAjuste.RENEGOCIACAO)).toBe(false);
    expect(aumentoPermitido(TipoAjuste.PERDAO)).toBe(false);
  });
});

describe("validarDirecaoAjuste", () => {
  it("desconto deve ter valorPara <= valorDe", () => {
    expect(validarDirecaoAjuste(TipoAjuste.DESCONTO, 100, 80)).toBeNull(); // desconto válido
    expect(validarDirecaoAjuste(TipoAjuste.DESCONTO, 100, 100)).toBeNull(); // sem mudança
    expect(validarDirecaoAjuste(TipoAjuste.DESCONTO, 100, 0)).toBeNull(); // desconto total
  });

  it("recusa aumento disfarçado de desconto", () => {
    expect(validarDirecaoAjuste(TipoAjuste.DESCONTO, 100, 120)).toMatch(/aumentar/i);
    expect(validarDirecaoAjuste(TipoAjuste.BOLSA, 100, 120)).toMatch(/aumentar/i);
    expect(validarDirecaoAjuste(TipoAjuste.RENEGOCIACAO, 100, 120)).toMatch(/aumentar/i);
  });

  it("permite aumento explícito em ALTERACAO_VALOR", () => {
    expect(validarDirecaoAjuste(TipoAjuste.ALTERACAO_VALOR, 100, 120)).toBeNull();
    expect(validarDirecaoAjuste(TipoAjuste.ALTERACAO_VALOR, 100, 80)).toBeNull();
  });
});

describe("descontoPercentual", () => {
  it("calcula o percentual de redução", () => {
    expect(descontoPercentual(100, 80)).toBeCloseTo(20);
    expect(descontoPercentual(200, 50)).toBeCloseTo(75);
    expect(descontoPercentual(100, 0)).toBeCloseTo(100); // desconto total
  });

  it("é 0 para aumento ou base zero", () => {
    expect(descontoPercentual(100, 120)).toBe(0); // aumento não é desconto
    expect(descontoPercentual(0, 0)).toBe(0);
  });
});

describe("precisaAprovacaoDesconto", () => {
  it("Financeiro/Admin (sem limite) nunca precisa de aprovação", () => {
    expect(
      precisaAprovacaoDesconto({ podeAplicarSemLimite: true, limiteDescontoPct: null, descontoPct: 90 }),
    ).toBe(false);
  });

  it("Vendedor: desconto dentro do limite aplica direto", () => {
    expect(
      precisaAprovacaoDesconto({ podeAplicarSemLimite: false, limiteDescontoPct: 15, descontoPct: 10 }),
    ).toBe(false);
    expect(
      precisaAprovacaoDesconto({ podeAplicarSemLimite: false, limiteDescontoPct: 15, descontoPct: 15 }),
    ).toBe(false); // exatamente no limite
  });

  it("Vendedor: desconto acima do limite vai para aprovação", () => {
    expect(
      precisaAprovacaoDesconto({ podeAplicarSemLimite: false, limiteDescontoPct: 15, descontoPct: 20 }),
    ).toBe(true);
  });

  it("Vendedor: desconto total acima do limite vai para aprovação", () => {
    expect(
      precisaAprovacaoDesconto({ podeAplicarSemLimite: false, limiteDescontoPct: 15, descontoPct: 100 }),
    ).toBe(true);
  });

  it("Vendedor com limite NULO não vira ilimitado: qualquer desconto precisa de aprovação", () => {
    expect(
      precisaAprovacaoDesconto({ podeAplicarSemLimite: false, limiteDescontoPct: null, descontoPct: 1 }),
    ).toBe(true);
    expect(
      precisaAprovacaoDesconto({ podeAplicarSemLimite: false, limiteDescontoPct: null, descontoPct: 100 }),
    ).toBe(true);
  });

  it("aumento (descontoPct <= 0) não exige aprovação por limite", () => {
    expect(
      precisaAprovacaoDesconto({ podeAplicarSemLimite: false, limiteDescontoPct: null, descontoPct: 0 }),
    ).toBe(false);
  });
});
