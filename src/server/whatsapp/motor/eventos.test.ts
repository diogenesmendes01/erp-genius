import { describe, expect, it } from "vitest";
import { EnvelopeMotorSchema } from "./eventos";

const base = { idEvento: "0b9f3c1e-6c1d-4a55-9d3e-2f6f8a1b7c10", tipo: "mensagem.recebida", numeroId: "n1", ocorridoEm: 1_790_000_000_000, dados: { texto: "oi" } };

describe("EnvelopeMotorSchema", () => {
  it("aceita o envelope do MODO-SERVICO", () => {
    expect(EnvelopeMotorSchema.safeParse(base).success).toBe(true);
  });
  it("recusa idEvento que não é UUID", () => {
    expect(EnvelopeMotorSchema.safeParse({ ...base, idEvento: "abc" }).success).toBe(false);
  });
  it("recusa ocorridoEm não numérico", () => {
    expect(EnvelopeMotorSchema.safeParse({ ...base, ocorridoEm: "ontem" }).success).toBe(false);
  });
});
