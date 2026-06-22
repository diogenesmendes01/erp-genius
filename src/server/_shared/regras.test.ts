import { describe, it, expect } from "vitest";
import { EtapaLead } from "@prisma/client";
import { calcularComissao, vencimentoMensalidade, ehEtapaManual } from "./regras";

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
