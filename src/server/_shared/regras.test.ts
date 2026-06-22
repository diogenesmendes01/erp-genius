import { describe, it, expect } from "vitest";
import { EtapaLead } from "@prisma/client";
import {
  calcularComissao,
  vencimentoMensalidade,
  vencimentoPrimeiraMensalidade,
  ehEtapaManual,
} from "./regras";

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

describe("vencimentoPrimeiraMensalidade", () => {
  it("vence 30 dias após o início da 1ª aula, ajustado ao dia escolhido", () => {
    // início 01/jun/2026 + 30 dias = 01/jul/2026 → dia 5 = 05/jul/2026
    const inicio = new Date(2026, 5, 1);
    const { data, competencia } = vencimentoPrimeiraMensalidade(5, inicio);
    expect(data.getFullYear()).toBe(2026);
    expect(data.getMonth()).toBe(6); // julho
    expect(data.getDate()).toBe(5);
    expect(competencia).toBe("2026-07");
  });

  it("respeita o dia de vencimento selecionado (ex.: 20)", () => {
    const inicio = new Date(2026, 5, 1);
    const { data } = vencimentoPrimeiraMensalidade(20, inicio);
    expect(data.getMonth()).toBe(6);
    expect(data.getDate()).toBe(20);
  });

  it("vira o mês/ano quando início + 30 dias cruza a virada", () => {
    // início 15/dez/2026 + 30 dias = 14/jan/2027 → dia 10 = 10/jan/2027
    const inicio = new Date(2026, 11, 15);
    const { data, competencia } = vencimentoPrimeiraMensalidade(10, inicio);
    expect(data.getFullYear()).toBe(2027);
    expect(data.getMonth()).toBe(0); // janeiro
    expect(data.getDate()).toBe(10);
    expect(competencia).toBe("2027-01");
  });

  it("sem data de início da turma, usa o fallback (+30 dias)", () => {
    const fallback = new Date(2026, 5, 1);
    const { data } = vencimentoPrimeiraMensalidade(15, null, fallback);
    expect(data.getMonth()).toBe(6); // julho
    expect(data.getDate()).toBe(15);
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
