import { describe, it, expect } from "vitest";
import {
  validarDocumento,
  calcularDocumentoValido,
  telefoneE164,
  paraDataLocal,
  dataOpcional,
  paraDataHoraLocal,
  dataHoraOpcional,
  analisarComDatasDaEscola,
} from "./validacao";
import { z } from "zod";

describe("validarDocumento (cpf)", () => {
  it("aceita CPF válido (com ou sem máscara)", () => {
    expect(validarDocumento("cpf", "529.982.247-25")).toBe(true);
    expect(validarDocumento("cpf", "52998224725")).toBe(true);
  });
  it("recusa CPF com dígito verificador errado ou repetido", () => {
    expect(validarDocumento("cpf", "12345678900")).toBe(false);
    expect(validarDocumento("cpf", "11111111111")).toBe(false);
  });
  it("validador desconhecido → não validado (false), nunca lança", () => {
    expect(validarDocumento("inexistente", "qualquer")).toBe(false);
  });
});

describe("calcularDocumentoValido (flag Aluno.documentoValido)", () => {
  const cpf = [{ validador: "cpf" }];
  it("documento VÁLIDO para algum validador do país → true", () => {
    expect(calcularDocumentoValido(cpf, "529.982.247-25")).toBe(true);
  });
  it("documento INVÁLIDO para os validadores do país → false (mas não lança)", () => {
    expect(calcularDocumentoValido(cpf, "12345678900")).toBe(false);
  });
  it("AUSÊNCIA de documento (null/undefined/vazio/só espaços) → false", () => {
    expect(calcularDocumentoValido(cpf, null)).toBe(false);
    expect(calcularDocumentoValido(cpf, undefined)).toBe(false);
    expect(calcularDocumentoValido(cpf, "")).toBe(false);
    expect(calcularDocumentoValido(cpf, "   ")).toBe(false);
  });
  it("aceita se passar em QUALQUER validador do país (1+ tipos)", () => {
    const dois = [{ validador: "passaporte" }, { validador: "cpf" }];
    expect(calcularDocumentoValido(dois, "529.982.247-25")).toBe(true);
  });
  it("país sem tipos de documento ou só validadores desconhecidos → false", () => {
    expect(calcularDocumentoValido([], "529.982.247-25")).toBe(false);
    expect(calcularDocumentoValido([{ validador: "inexistente" }], "529.982.247-25")).toBe(false);
  });
});

describe("telefoneE164 (bloqueia)", () => {
  it("aceita formato internacional", () => {
    expect(telefoneE164.safeParse("+5511999998888").success).toBe(true);
    expect(telefoneE164.safeParse("+506888899").success).toBe(true);
  });
  it("recusa sem + ou com caracteres inválidos", () => {
    expect(telefoneE164.safeParse("11999998888").success).toBe(false);
    expect(telefoneE164.safeParse("abc").success).toBe(false);
    expect(telefoneE164.safeParse("").success).toBe(false);
  });
});

// Ref. #247: a data digitada é um dia civil da ESCOLA. Vira o meio-dia do fuso da escola, nunca o do relógio do
// servidor (UTC em produção). Instantes fixos; verde com TZ=UTC e TZ=America/Sao_Paulo.
describe("paraDataLocal (date-only → meio-dia da escola, sem recuar 1 dia)", () => {
  it("ancora 'YYYY-MM-DD' no meio-dia do fuso da escola", () => {
    expect(paraDataLocal("2026-01-01", "America/Sao_Paulo")).toEqual(new Date("2026-01-01T15:00:00.000Z"));
    expect(paraDataLocal("2026-01-01", "America/Costa_Rica")).toEqual(new Date("2026-01-01T18:00:00.000Z"));
    expect(paraDataLocal("2026-07-01", "Asia/Tokyo")).toEqual(new Date("2026-07-01T03:00:00.000Z"));
  });
  it("mantém a normalização antiga de dia inexistente (31/02 → 03/03)", () => {
    expect(paraDataLocal("2026-02-31", "America/Sao_Paulo")).toEqual(new Date("2026-03-03T15:00:00.000Z"));
  });
  it("sem o fuso da escola recusa a data digitada, em vez de cair no relógio do servidor", () => {
    expect(() => paraDataLocal("2026-01-01")).toThrow(/fuso da escola/);
  });
  it("deixa valores não-date-only passarem inalterados (Date, datetime ISO)", () => {
    const date = new Date("2026-03-10T08:00:00Z");
    expect(paraDataLocal(date)).toBe(date);
    expect(paraDataLocal("2026-03-10T08:00:00Z")).toBe("2026-03-10T08:00:00Z");
    expect(paraDataLocal(undefined)).toBeUndefined();
  });
});

describe("dataOpcional (schema compartilhado)", () => {
  it("dentro de analisarComDatasDaEscola, converte a data digitada para o meio-dia da escola", () => {
    expect(analisarComDatasDaEscola(dataOpcional, "2026-01-01", "America/Sao_Paulo")).toEqual(new Date("2026-01-01T15:00:00.000Z"));
    const schema = z.object({ inicio: dataOpcional, fim: dataOpcional });
    expect(analisarComDatasDaEscola(schema, { inicio: "2026-01-01", fim: "" }, "America/Costa_Rica"))
      .toEqual({ inicio: new Date("2026-01-01T18:00:00.000Z"), fim: undefined });
  });
  it("o fuso vale só durante o parse", () => {
    analisarComDatasDaEscola(dataOpcional, "2026-01-01", "America/Sao_Paulo");
    expect(() => dataOpcional.parse("2026-01-01")).toThrow(/fuso da escola/);
    expect(() => analisarComDatasDaEscola(z.object({ d: dataOpcional, n: z.number() }), { d: "2026-01-01", n: "x" }, "America/Sao_Paulo")).toThrow();
    expect(() => dataOpcional.parse("2026-01-01")).toThrow(/fuso da escola/);
  });
  it("trata vazio/null/undefined como undefined", () => {
    expect(dataOpcional.parse("")).toBeUndefined();
    expect(dataOpcional.parse(null)).toBeUndefined();
    expect(dataOpcional.parse(undefined)).toBeUndefined();
  });
});

describe("paraDataHoraLocal (datetime-local → preserva a hora, issue #16)", () => {
  it("converte 'YYYY-MM-DDTHH:mm' mantendo a hora LOCAL digitada", () => {
    const d = paraDataHoraLocal("2026-06-22T14:30") as Date;
    expect(d).toBeInstanceOf(Date);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // junho
    expect(d.getDate()).toBe(22);
    expect(d.getHours()).toBe(14); // hora NÃO é descartada nem ancorada no meio-dia
    expect(d.getMinutes()).toBe(30);
  });
  it("aceita segundos opcionais", () => {
    const d = paraDataHoraLocal("2026-06-22T14:30:45") as Date;
    expect(d.getSeconds()).toBe(45);
  });
  it("date-only cai no meio-dia da escola (reusa paraDataLocal)", () => {
    const d = analisarComDatasDaEscola(dataHoraOpcional, "2026-06-22", "America/Sao_Paulo");
    expect(d).toEqual(new Date("2026-06-22T15:00:00.000Z"));
  });
  it("deixa outros valores passarem inalterados", () => {
    const date = new Date("2026-03-10T08:00:00Z");
    expect(paraDataHoraLocal(date)).toBe(date);
    expect(paraDataHoraLocal(undefined)).toBeUndefined();
  });
});

describe("dataHoraOpcional (schema datetime-local)", () => {
  it("preserva o horário do datetime-local", () => {
    const r = dataHoraOpcional.parse("2026-06-22T09:15") as Date;
    expect(r.getHours()).toBe(9);
    expect(r.getMinutes()).toBe(15);
  });
  it("trata vazio/null/undefined como undefined", () => {
    expect(dataHoraOpcional.parse("")).toBeUndefined();
    expect(dataHoraOpcional.parse(null)).toBeUndefined();
    expect(dataHoraOpcional.parse(undefined)).toBeUndefined();
  });
});
