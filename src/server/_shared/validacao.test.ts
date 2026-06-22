import { describe, it, expect } from "vitest";
import {
  validarDocumento,
  telefoneE164,
  paraDataLocal,
  dataOpcional,
  paraDataHoraLocal,
  dataHoraOpcional,
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
  it("date-only cai no meio-dia local (reusa paraDataLocal)", () => {
    const d = paraDataHoraLocal("2026-06-22") as Date;
    expect(d.getHours()).toBe(12);
    expect(d.getDate()).toBe(22);
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
