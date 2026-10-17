import { describe, expect, it } from "vitest";
import { intencaoEmShadow, type EntradaShadow } from "./despachante";

// Revisão R1 do #208 (C1): trava unitária da decisão de shadow. A isenção do aviso de agenda
// (`!agenda`) caiu no merge da #161 e só os *.int.test.ts perceberiam — que o CI não roda.
const base: EntradaShadow = {
  live: true,
  agenda: false,
  automatica: true,
  reativa: false,
  gestao: false,
  politicaEstado: "ATIVA",
  gestaoEstado: "ATIVA",
  saudacaoEstado: "ATIVA",
};
const shadow = (parcial: Partial<EntradaShadow>) => intencaoEmShadow({ ...base, ...parcial });

describe("intencaoEmShadow", () => {
  describe("política de cobrança DESLIGADA", () => {
    it("aviso de agenda NÃO vira SIMULADA", () => {
      expect(shadow({ agenda: true, politicaEstado: "DESLIGADA" })).toBe(false);
    });

    it("aviso de agenda NÃO vira SIMULADA com a política em SHADOW", () => {
      expect(shadow({ agenda: true, politicaEstado: "SHADOW" })).toBe(false);
    });

    it("gestão NÃO vira SIMULADA (olha só o gestaoEstado)", () => {
      expect(shadow({ gestao: true, politicaEstado: "DESLIGADA" })).toBe(false);
    });

    it("cobrança comum vira SIMULADA", () => {
      expect(shadow({ politicaEstado: "DESLIGADA" })).toBe(true);
    });

    it("cobrança comum em SHADOW também vira SIMULADA", () => {
      expect(shadow({ politicaEstado: "SHADOW" })).toBe(true);
    });

    it("reativa NÃO vira SIMULADA (olha só o saudacaoEstado)", () => {
      expect(shadow({ reativa: true, politicaEstado: "DESLIGADA" })).toBe(false);
    });

    it("origem HUMANO NÃO vira SIMULADA (decisão humana envia mesmo em ensaio)", () => {
      expect(shadow({ automatica: false, politicaEstado: "DESLIGADA" })).toBe(false);
    });
  });

  it("política ATIVA com tudo ligado: envia de verdade", () => {
    expect(shadow({})).toBe(false);
    expect(shadow({ agenda: true })).toBe(false);
    expect(shadow({ gestao: true })).toBe(false);
    expect(shadow({ reativa: true })).toBe(false);
    expect(shadow({ automatica: false })).toBe(false);
  });

  it("sem WHATSAPP_LIVE simula tudo, inclusive agenda, gestão, reativa e HUMANO", () => {
    for (const parcial of [{}, { agenda: true }, { gestao: true }, { reativa: true }, { automatica: false }]) {
      expect(shadow({ ...parcial, live: false })).toBe(true);
    }
  });

  it("gestão com gestaoEstado fora de ATIVA vira SIMULADA, mesmo com a política ATIVA", () => {
    expect(shadow({ gestao: true, gestaoEstado: "SHADOW" })).toBe(true);
    expect(shadow({ gestao: true, gestaoEstado: "DESLIGADA" })).toBe(true);
  });

  it("gestaoEstado não afeta quem não é gestão", () => {
    expect(shadow({ gestaoEstado: "DESLIGADA" })).toBe(false);
    expect(shadow({ agenda: true, gestaoEstado: "DESLIGADA" })).toBe(false);
  });

  it("reativa com saudacaoEstado fora de ATIVA vira SIMULADA, mesmo com a política ATIVA", () => {
    expect(shadow({ reativa: true, saudacaoEstado: "SHADOW" })).toBe(true);
    expect(shadow({ reativa: true, saudacaoEstado: "DESLIGADA" })).toBe(true);
  });

  it("saudacaoEstado não afeta quem não é reativa", () => {
    expect(shadow({ saudacaoEstado: "DESLIGADA" })).toBe(false);
    expect(shadow({ agenda: true, saudacaoEstado: "DESLIGADA" })).toBe(false);
  });
});
