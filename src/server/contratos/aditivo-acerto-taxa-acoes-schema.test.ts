import { describe, expect, it } from "vitest";
import { ProporAcertoTaxaSchema } from "./aditivo-acerto-taxa-acoes-schema";
describe("acerto de taxa schema", () => { it("exige a cobrança real e fotografia da conferência", () => expect(() => ProporAcertoTaxaSchema.parse({ matriculaId: "m", propostaAditivoId: "p", conclusaoId: "c", revisaoHash: "a".repeat(64), motivo: "motivo válido", evidencia: {}, chaveIdempotencia: "k" })).toThrow()); });
