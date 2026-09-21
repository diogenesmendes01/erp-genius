import { describe, expect, it } from "vitest";
import { expandirCoberturaMensal } from "./cronograma-cobertura";
import { CoberturaInicialSchema } from "./cobertura";
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
describe("cobertura do cronograma inicial", () => {
  it("valida a entrada contratual sem aceitar datas inexistentes ou mês civil parcial", () => {
    expect(CoberturaInicialSchema.safeParse({ referencia: "MES_CIVIL", inicio: "2028-02-01" }).success).toBe(true);
    expect(CoberturaInicialSchema.safeParse({ referencia: "MES_CIVIL", inicio: "2028-02-02" }).success).toBe(false);
    expect(CoberturaInicialSchema.safeParse({ referencia: "CICLO_MATRICULA", inicio: "2027-02-29" }).success).toBe(false);
    expect(CoberturaInicialSchema.safeParse({ referencia: "CICLO_MATRICULA", inicio: "2028-02-29" }).success).toBe(true);
  });
  it("conserva a âncora 31 após fevereiro sem lacuna ou sobreposição", () => {
    expect(expandirCoberturaMensal({ referenciaCobertura: "CICLO_MATRICULA", dataReferenciaCobertura: d("2028-01-31") },
      { coberturaInicio: d("2028-01-31"), coberturaFim: d("2028-02-28") }, 2)).toEqual([
      { coberturaInicio: d("2028-02-29"), coberturaFim: d("2028-03-30") },
      { coberturaInicio: d("2028-03-31"), coberturaFim: d("2028-04-29") },
    ]);
  });
  it("gera meses civis incluindo fevereiro bissexto", () => {
    expect(expandirCoberturaMensal({ referenciaCobertura: "MES_CIVIL", dataReferenciaCobertura: null },
      { coberturaInicio: d("2028-01-01"), coberturaFim: d("2028-01-31") }, 1)).toEqual([
      { coberturaInicio: d("2028-02-01"), coberturaFim: d("2028-02-29") },
    ]);
  });
  it("não inventa cobertura para legado nem aceita informação parcial", () => {
    const contrato = { referenciaCobertura: null, dataReferenciaCobertura: null };
    expect(() => expandirCoberturaMensal(contrato, { coberturaInicio: null, coberturaFim: null }, 2)).toThrow(/confira/i);
    expect(() => expandirCoberturaMensal(contrato, { coberturaInicio: d("2028-01-01"), coberturaFim: null }, 2)).toThrow(/confira/i);
    expect(() => expandirCoberturaMensal({ referenciaCobertura: "MES_CIVIL", dataReferenciaCobertura: null },
      { coberturaInicio: d("2028-01-01"), coberturaFim: d("2028-02-01") }, 2)).toThrow(/período completo/i);
  });
});
