import { describe, it, expect } from "vitest";
import { EtapaLead } from "@prisma/client";
import {
  calcularComissao,
  vencimentoMensalidade,
  ehEtapaManual,
  acumularPagamento,
} from "./regras";
import { ErroRegra } from "./sessao";

describe("calcularComissao", () => {
  it("é a porcentagem da taxa", () => {
    expect(calcularComissao(299, 20)).toBeCloseTo(59.8);
    expect(calcularComissao(20000, 20)).toBe(4000);
    expect(calcularComissao(1000, 0)).toBe(0);
  });
});

describe("vencimentoMensalidade", () => {
  const base = new Date(2026, 5, 18); // junho/2026

  it("usa o dia escolhido no mês atual (offset 0)", () => {
    const { data, competencia } = vencimentoMensalidade(5, 0, base);
    expect(data.getDate()).toBe(5);
    expect(competencia).toBe("2026-06");
  });

  it("avança meses com o offset (vira o ano)", () => {
    expect(vencimentoMensalidade(10, 1, base).competencia).toBe("2026-07");
    expect(vencimentoMensalidade(10, 7, base).competencia).toBe("2027-01");
  });
});

describe("ehEtapaManual", () => {
  it("aceita etapas do funil normal", () => {
    expect(ehEtapaManual(EtapaLead.NOVO)).toBe(true);
    expect(ehEtapaManual(EtapaLead.PROPOSTA)).toBe(true);
  });
  it("recusa etapas de fluxo próprio (Perdido / Matriculado)", () => {
    expect(ehEtapaManual(EtapaLead.PERDIDO)).toBe(false);
    expect(ehEtapaManual(EtapaLead.MATRICULADO)).toBe(false);
  });
});

describe("acumularPagamento", () => {
  it("pagamento parcial não quita e gera saldo pelo valor atual", () => {
    const r = acumularPagamento(0, 1000, 300);
    expect(r.recebidoTotal).toBe(300);
    expect(r.saldo).toBe(700);
    expect(r.quitada).toBe(false);
    expect(r.excedente).toBe(0);
  });

  it("parciais sucessivos ACUMULAM e o saldo cai pelo total recebido", () => {
    // primeiro recebe 300 (jaRecebido=0), depois 400 sobre os 300 anteriores
    const primeiro = acumularPagamento(0, 1000, 300);
    const segundo = acumularPagamento(primeiro.recebidoTotal, 1000, 400);
    expect(segundo.recebidoTotal).toBe(700);
    expect(segundo.saldo).toBe(300);
    expect(segundo.quitada).toBe(false);
  });

  it("quita só quando o ACUMULADO cobre o valor negociado", () => {
    const r = acumularPagamento(700, 1000, 300);
    expect(r.recebidoTotal).toBe(1000);
    expect(r.saldo).toBe(0);
    expect(r.quitada).toBe(true);
    expect(r.excedente).toBe(0);
  });

  it("pagamento total de uma vez quita", () => {
    const r = acumularPagamento(0, 1000, 1000);
    expect(r.quitada).toBe(true);
    expect(r.saldo).toBe(0);
  });

  it("bloqueia recebimento acima do negociado por padrão", () => {
    expect(() => acumularPagamento(800, 1000, 300)).toThrow(ErroRegra);
    expect(() => acumularPagamento(0, 1000, 1500)).toThrow(/excede/i);
  });

  it("aceita excedente como crédito explícito quando permitido", () => {
    const r = acumularPagamento(800, 1000, 300, true);
    expect(r.recebidoTotal).toBe(1100);
    expect(r.saldo).toBe(0);
    expect(r.quitada).toBe(true);
    expect(r.excedente).toBe(100);
  });

  it("rejeita valor não positivo", () => {
    expect(() => acumularPagamento(0, 1000, 0)).toThrow(ErroRegra);
    expect(() => acumularPagamento(0, 1000, -50)).toThrow(/maior que zero/i);
  });
});
