import { describe, expect, it } from "vitest";
import { fusoDoCampoLocal, instanteDoCampoLocal, valorCampoLocal } from "./fuso-entrada";
import { exigirInstanteDoCampoLocal } from "@/server/_shared/campo-local";
import { ErroRegra } from "@/server/_shared/sessao";

// Lote 3 do fuso pessoal nas telas: campo de ENTRADA datetime-local. Expectativas fixas (instantes ISO absolutos):
// a suíte roda em TZ=UTC e TZ=America/Sao_Paulo no CI e o resultado não pode depender do fuso do processo.
const ok = (local: string, fuso: string) => {
  const r = instanteDoCampoLocal(local, fuso);
  if (!r.ok) throw new Error(r.erro);
  return r.instante.toISOString();
};

describe("instanteDoCampoLocal: o texto digitado no fuso informado, nunca no do processo", () => {
  it("lê no fuso do campo (São Paulo, Costa Rica, Tóquio, UTC)", () => {
    expect(ok("2026-10-21T20:30", "America/Sao_Paulo")).toBe("2026-10-21T23:30:00.000Z");
    expect(ok("2026-10-21T20:30", "America/Costa_Rica")).toBe("2026-10-22T02:30:00.000Z");
    expect(ok("2026-10-21T20:30", "Asia/Tokyo")).toBe("2026-10-21T11:30:00.000Z");
    expect(ok("2026-10-21T20:30", "UTC")).toBe("2026-10-21T20:30:00.000Z");
  });

  it("virada do dia: 22:30 em São Paulo já é o dia seguinte em UTC; 01:00 em Tóquio ainda é o dia anterior", () => {
    expect(ok("2026-10-21T22:30", "America/Sao_Paulo")).toBe("2026-10-22T01:30:00.000Z");
    expect(ok("2026-12-31T23:59", "America/Sao_Paulo")).toBe("2027-01-01T02:59:00.000Z");
    expect(ok("2026-10-22T01:00", "Asia/Tokyo")).toBe("2026-10-21T16:00:00.000Z");
  });

  it("segundos e milissegundos (step) são preservados", () => {
    expect(ok("2026-10-21T20:30:15", "America/Sao_Paulo")).toBe("2026-10-21T23:30:15.000Z");
    expect(ok("2026-10-21T20:30:15.250", "America/Sao_Paulo")).toBe("2026-10-21T23:30:15.250Z");
    expect(ok("2026-10-21T20:30:15.5", "America/Sao_Paulo")).toBe("2026-10-21T23:30:15.500Z");
  });

  it("horário de verão: o horário pulado e o repetido são recusados, não escolhidos em silêncio", () => {
    const pulado = instanteDoCampoLocal("2026-03-08T02:30", "America/New_York");
    const repetido = instanteDoCampoLocal("2026-11-01T01:30", "America/New_York");
    expect(pulado).toEqual({ ok: false, erro: expect.stringMatching(/não existe em America\/New_York/) });
    expect(repetido).toEqual({ ok: false, erro: expect.stringMatching(/se repete em America\/New_York/) });
  });

  it("fuso inválido ou ausente, formato inválido e data impossível: erro legível, sem lançar", () => {
    expect(instanteDoCampoLocal("2026-10-21T20:30", "")).toEqual({ ok: false, erro: expect.stringMatching(/fuso válido/) });
    expect(instanteDoCampoLocal("2026-10-21T20:30", "Lua/Base")).toEqual({ ok: false, erro: expect.stringMatching(/fuso válido/) });
    expect(instanteDoCampoLocal("", "UTC")).toEqual({ ok: false, erro: "Informe data e hora completas." });
    expect(instanteDoCampoLocal("2026-10-21", "UTC")).toEqual({ ok: false, erro: "Informe data e hora completas." });
    expect(instanteDoCampoLocal("2026-10-21T24:00", "UTC")).toEqual({ ok: false, erro: "Informe data e hora completas." });
    expect(instanteDoCampoLocal("2026-02-31T10:00", "UTC")).toEqual({ ok: false, erro: "Data inexistente; confira o dia e o mês." });
    expect(instanteDoCampoLocal("2026-10-21T20:30Z", "UTC").ok).toBe(false);
  });

  it("no servidor (exigirInstanteDoCampoLocal), o erro vira ErroRegra; nada de fallback", () => {
    expect(exigirInstanteDoCampoLocal("2026-10-21T20:30", "America/Sao_Paulo").toISOString()).toBe("2026-10-21T23:30:00.000Z");
    expect(() => exigirInstanteDoCampoLocal("2026-10-21T20:30", undefined)).toThrow(ErroRegra);
    expect(() => exigirInstanteDoCampoLocal(undefined, "UTC")).toThrow(ErroRegra);
  });
});

describe("valorCampoLocal: valor inicial do campo no mesmo fuso em que ele é lido", () => {
  it("escreve o instante no fuso, inclusive na virada do dia", () => {
    expect(valorCampoLocal("2026-10-22T01:30:00.000Z", "America/Sao_Paulo")).toBe("2026-10-21T22:30");
    expect(valorCampoLocal(new Date("2026-10-22T01:30:00.000Z"), "UTC")).toBe("2026-10-22T01:30");
    expect(valorCampoLocal("2026-10-21T16:00:00.000Z", "Asia/Tokyo")).toBe("2026-10-22T01:00");
  });

  it("ida e volta: o valor inicial convertido de volta é o mesmo instante (minuto, segundo, milissegundo)", () => {
    for (const fuso of ["America/Sao_Paulo", "America/Costa_Rica", "Asia/Tokyo", "UTC"]) {
      const instante = "2026-10-22T01:30:45.123Z";
      expect(ok(valorCampoLocal(instante, fuso), fuso)).toBe("2026-10-22T01:30:00.000Z");
      expect(ok(valorCampoLocal(instante, fuso, "segundo"), fuso)).toBe("2026-10-22T01:30:45.000Z");
      expect(ok(valorCampoLocal(instante, fuso, "milissegundo"), fuso)).toBe(instante);
    }
  });

  it("fallback documentado: fuso inválido escreve em UTC; valor ausente ou inválido vira campo vazio; não lança", () => {
    expect(valorCampoLocal("2026-10-22T01:30:00.000Z", "Lua/Base")).toBe("2026-10-22T01:30");
    expect(valorCampoLocal(null, "America/Sao_Paulo")).toBe("");
    expect(valorCampoLocal("", "America/Sao_Paulo")).toBe("");
    expect(valorCampoLocal("ontem", "America/Sao_Paulo")).toBe("");
  });
});

describe("fusoDoCampoLocal: o fuso escrito ao lado do campo", () => {
  it("pessoal válido; sem ele, o da escola; nenhum válido, UTC (escrito, não presumido calado)", () => {
    expect(fusoDoCampoLocal("Asia/Tokyo", "America/Sao_Paulo")).toBe("Asia/Tokyo");
    expect(fusoDoCampoLocal(null, "America/Sao_Paulo")).toBe("America/Sao_Paulo");
    expect(fusoDoCampoLocal("Lua/Base", "America/Costa_Rica")).toBe("America/Costa_Rica");
    expect(fusoDoCampoLocal(undefined, null)).toBe("UTC");
    expect(fusoDoCampoLocal("", "Lua/Base")).toBe("UTC");
  });
});
