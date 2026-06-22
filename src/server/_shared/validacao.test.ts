import { describe, it, expect } from "vitest";
import {
  validarDocumento,
  calcularDocumentoValido,
  telefoneE164,
  paraDataLocal,
  dataOpcional,
} from "./validacao";

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

describe("paraDataLocal (date-only → meio-dia local, sem recuar 1 dia)", () => {
  it("ancora 'YYYY-MM-DD' no meio-dia LOCAL do dia digitado", () => {
    const d = paraDataLocal("2026-01-01") as Date;
    expect(d).toBeInstanceOf(Date);
    // O dia digitado é o dia exibido em qualquer fuso (não recua p/ 31/12).
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0); // janeiro
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(12); // meio-dia local → margem de ±12h contra o fuso
  });
  it("deixa valores não-date-only passarem inalterados (Date, datetime ISO)", () => {
    const date = new Date("2026-03-10T08:00:00Z");
    expect(paraDataLocal(date)).toBe(date);
    expect(paraDataLocal("2026-03-10T08:00:00Z")).toBe("2026-03-10T08:00:00Z");
    expect(paraDataLocal(undefined)).toBeUndefined();
  });
});

describe("dataOpcional (schema compartilhado)", () => {
  it("converte string date-only para Date no dia digitado", () => {
    const r = dataOpcional.parse("2026-01-01") as Date;
    expect(r.getFullYear()).toBe(2026);
    expect(r.getMonth()).toBe(0);
    expect(r.getDate()).toBe(1);
  });
  it("trata vazio/null/undefined como undefined", () => {
    expect(dataOpcional.parse("")).toBeUndefined();
    expect(dataOpcional.parse(null)).toBeUndefined();
    expect(dataOpcional.parse(undefined)).toBeUndefined();
  });
});
