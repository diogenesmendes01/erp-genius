import { describe, expect, it } from "vitest";
import * as schemas from "./schema";

describe("editar previsão sem ampliar criação", () => {
  it("aceita os campos opcionais apenas no schema de edição", () => {
    const editar = (schemas as unknown as Record<string, typeof schemas.LeadSchema>).EditarLeadSchema;
    expect(editar).toBeDefined();
    expect(editar.parse({ nome: "Ana", probabilidadePct: 0, previsaoFechamento: "2026-09-06" })).toMatchObject({ probabilidadePct: 0, previsaoFechamento: "2026-09-06" });
  });
  it("preserva omissão e permite null explícito na edição", () => {
    const editar = (schemas as unknown as Record<string, typeof schemas.LeadSchema>).EditarLeadSchema;
    expect(editar).toBeDefined();
    expect(editar.parse({ nome: "Ana" })).not.toHaveProperty("probabilidadePct");
    expect(editar.parse({ nome: "Ana", probabilidadePct: null, previsaoFechamento: null })).toMatchObject({ probabilidadePct: null, previsaoFechamento: null });
  });
  it("mantém os schemas legados sem os novos campos", () => {
    for (const schema of [schemas.LeadSchema, schemas.CriarLeadSchema]) {
      const dados = schema.parse({ nome: "Ana", probabilidadePct: 90, previsaoFechamento: "2026-09-06" });
      expect(dados).not.toHaveProperty("probabilidadePct");
      expect(dados).not.toHaveProperty("previsaoFechamento");
    }
  });
});