import { describe, expect, it } from "vitest";
import { classesDoPainel, painelEfetivo, proximoEstadoPainel } from "./painel-inbox";

describe("casca responsiva do painel", () => {
  it("uma vista abaixo do limiar uniforme; abrir painel mantém a preferência e muda a vista", () => {
    expect(proximoEstadoPainel(null, 700)).toEqual({ aberto: null, vista: "painel" });
    expect(proximoEstadoPainel(false, 959)).toEqual({ aberto: false, vista: "painel" });
    expect(painelEfetivo(null, "conversa", 959)).toBe(false);
    expect(painelEfetivo(false, "painel", 959)).toBe(true);
  });
  it("modo automático abre apenas quando as três colunas cabem", () => {
    expect(painelEfetivo(null, "conversa", 960)).toBe(false);
    expect(painelEfetivo(null, "conversa", 1280)).toBe(false);
    expect(painelEfetivo(null, "conversa", 1440)).toBe(true);
    expect(proximoEstadoPainel(null, 1440)).toEqual({ aberto: false });
    expect(proximoEstadoPainel(null, 1024)).toEqual({ aberto: true });
    expect(proximoEstadoPainel(true, 1024)).toEqual({ aberto: false });
  });
  it("CSS inicial preserva automático no SSR sem ler window", () => {
    expect(classesDoPainel(null, "conversa")).toContain("min-[1400px]:flex");
    expect(classesDoPainel(false, "conversa")).not.toContain("min-[1400px]:flex");
    expect(classesDoPainel(true, "conversa")).toContain("min-[960px]:max-[1399px]:absolute");
    expect(classesDoPainel(true, "conversa")).toContain("min-[960px]:max-[1399px]:shadow-dialog");
    expect(classesDoPainel(null, "painel")).toContain("flex");
    for (const estado of [null, true, false]) expect(classesDoPainel(estado, "conversa")).toContain("min-[960px]:w-[348px]");
  });
});
