import { describe, expect, it } from "vitest";
import { driverAceitaAutomacao, ErroDriver } from "./canal";

describe("driverAceitaAutomacao", () => {
  it("MOTOR e META_CLOUD aceitam; BAILEYS não", () => {
    expect(driverAceitaAutomacao("MOTOR")).toBe(true);
    expect(driverAceitaAutomacao("META_CLOUD")).toBe(true);
    expect(driverAceitaAutomacao("BAILEYS")).toBe(false);
  });
});

describe("ErroDriver", () => {
  it("padrão: não reprocessável, adiarMs 60000", () => {
    const e = new ErroDriver("x");
    expect(e.reprocessavel).toBe(false);
    expect(e.adiarMs).toBe(60_000);
  });
  it("aceita opções", () => {
    const e = new ErroDriver("x", "m", { reprocessavel: true, adiarMs: 5 });
    expect(e).toMatchObject({ reprocessavel: true, adiarMs: 5, message: "m" });
  });
});
