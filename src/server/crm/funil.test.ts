import { describe, it, expect } from "vitest";
import { lerFiltrosFunil } from "./funil";

describe("lerFiltrosFunil", () => {
  it("lê filtros válidos e descarta o resto", () => {
    expect(lerFiltrosFunil({ tipo: "b2b", temperatura: "XX", perdidosDias: "90", ordem: "valor" }))
      .toEqual({ busca: "", tipo: "b2b", donoId: "", temperatura: "", origem: "", tagId: "", perdidosDias: "90", ordem: "valor" });
  });
  it("vazio vira o padrão e valores em lista usam o primeiro", () => {
    expect(lerFiltrosFunil({ origem: ["SITE", "GOOGLE"], tipo: "x", ordem: "y", perdidosDias: "7" }))
      .toEqual({ busca: "", tipo: "", donoId: "", temperatura: "", origem: "SITE", tagId: "", perdidosDias: "todos", ordem: "recentes" });
  });
});
