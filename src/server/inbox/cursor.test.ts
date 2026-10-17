import { describe, expect, it } from "vitest";
import { codificarCursor, cursorThreadValido, decodificarCursor } from "./cursor";

describe("cursor do inbox", () => {
  it("cursor ida e volta; lixo vira null", () => {
    expect(decodificarCursor(codificarCursor({ em: null, id: "x" }))).toEqual({ em: null, id: "x" });
    expect(decodificarCursor(codificarCursor({ em: "2026-10-01T00:00:00.000Z", id: "y" }))).toEqual({ em: "2026-10-01T00:00:00.000Z", id: "y" });
    expect(decodificarCursor("%%%")).toBeNull();
    expect(decodificarCursor("")).toBeNull();
    expect(decodificarCursor(Buffer.from("[1]").toString("base64url"))).toBeNull();
    expect(decodificarCursor(Buffer.from(JSON.stringify({ em: "ontem", id: "x" })).toString("base64url"))).toBeNull();
    expect(decodificarCursor(Buffer.from(JSON.stringify({ em: null, id: 5 })).toString("base64url"))).toBeNull();
  });
  it("cursor da thread exige instante: em null é inválido", () => {
    expect(cursorThreadValido(codificarCursor({ em: null, id: "x" }))).toBe(false);
    expect(cursorThreadValido("lixo!")).toBe(false);
    expect(cursorThreadValido(codificarCursor({ em: "2026-10-01T00:00:00.000Z", id: "x" }))).toBe(true);
  });
});
