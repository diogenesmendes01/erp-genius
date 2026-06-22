import { describe, it, expect } from "vitest";
import { EtapaLead, TipoCobranca } from "@prisma/client";
import {
  calcularComissao,
  vencimentoMensalidade,
  ehEtapaManual,
  avaliarPrecoReferencia,
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

describe("avaliarPrecoReferencia", () => {
  it("não há ausência quando taxa + mensalidade existem", () => {
    const r = avaliarPrecoReferencia([
      { tipoCobranca: TipoCobranca.MATRICULA, valor: 100 },
      { tipoCobranca: TipoCobranca.MENSALIDADE, valor: 50 },
    ]);
    expect(r.ausente).toBe(false);
    expect(r.tiposAusentes).toEqual([]);
  });

  it("marca ausência quando falta a mensalidade", () => {
    const r = avaliarPrecoReferencia([
      { tipoCobranca: TipoCobranca.MATRICULA, valor: 100 },
    ]);
    expect(r.ausente).toBe(true);
    expect(r.tiposAusentes).toEqual([TipoCobranca.MENSALIDADE]);
  });

  it("marca ausência total quando não há preços ativos", () => {
    const r = avaliarPrecoReferencia([]);
    expect(r.ausente).toBe(true);
    expect(r.tiposAusentes).toEqual([TipoCobranca.MATRICULA, TipoCobranca.MENSALIDADE]);
  });

  it("ignora tipos extras irrelevantes (ex.: certificado)", () => {
    const r = avaliarPrecoReferencia([
      { tipoCobranca: TipoCobranca.MATRICULA, valor: 100 },
      { tipoCobranca: TipoCobranca.MENSALIDADE, valor: 50 },
      { tipoCobranca: TipoCobranca.CERTIFICADO, valor: 10 },
    ]);
    expect(r.ausente).toBe(false);
  });
});
