import { describe, expect, it } from "vitest";
import { COLUNAS_EXPORTACAO_CONTATOS, celulaSegura } from "./planilha";

describe("planilha de contatos", () => {
  it("celulaSegura neutraliza fórmula", () => {
    for (const v of ["=1+1", "+5511", "-2", "@SOMA", "\t=x", "\r=x"]) expect(celulaSegura(v).startsWith("'")).toBe(true);
    expect(celulaSegura("Ana")).toBe("Ana");
    expect(celulaSegura("")).toBe("");
  });

  it("colunas não incluem telefone nem e-mail", () => {
    expect([...COLUNAS_EXPORTACAO_CONTATOS]).toEqual(["Código", "Nome", "Tipo", "Cidade", "Origem", "Tags", "Etapa", "Responsável"]);
  });
});
