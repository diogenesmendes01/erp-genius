import { describe, expect, it } from "vitest";
import { fusoDoPrazoSegundaChamada } from "./segunda-chamada-prazo";

// Lote 3 do fuso pessoal nas telas: de onde vem o fuso do "prazo vigente" da remarcação. Antes:
// `estado.encontro?.fusoOrigem ?? "UTC"` — sem encontro, UTC; com fuso gravado inválido, a página lançava.
describe("fusoDoPrazoSegundaChamada", () => {
  it("o fuso da agenda (encontro) quando válido", () => {
    expect(fusoDoPrazoSegundaChamada("America/Costa_Rica", "America/Sao_Paulo")).toEqual({ fuso: "America/Costa_Rica", origem: "AGENDA" });
  });
  it("sem agenda, ou com fuso gravado inválido, o da escola — nunca UTC presumido", () => {
    expect(fusoDoPrazoSegundaChamada(null, "America/Sao_Paulo")).toEqual({ fuso: "America/Sao_Paulo", origem: "ESCOLA" });
    expect(fusoDoPrazoSegundaChamada(undefined, "America/Sao_Paulo")).toEqual({ fuso: "America/Sao_Paulo", origem: "ESCOLA" });
    expect(fusoDoPrazoSegundaChamada("Lua/Base", "America/Sao_Paulo")).toEqual({ fuso: "America/Sao_Paulo", origem: "ESCOLA" });
  });
  it("UTC só quando nem a agenda nem a escola têm fuso válido (e a tela escreve o fuso)", () => {
    expect(fusoDoPrazoSegundaChamada(null, "Lua/Base")).toEqual({ fuso: "UTC", origem: "ESCOLA" });
    expect(fusoDoPrazoSegundaChamada("", null)).toEqual({ fuso: "UTC", origem: "ESCOLA" });
  });
});
