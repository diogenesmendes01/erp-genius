import { describe, expect, it } from "vitest";
import { validarCoerenciaValoresAditivo } from "./aditivo-coerencia";

const origem = { moeda: "BRL", coberturaInicio: "2027-01-01", coberturaFim: "2027-01-31", fontesMonetarias: ["TAXA_VALOR", "MENSALIDADE_VALOR"] as const };
const dinheiro = (origem: "TAXA_VALOR" | "MENSALIDADE_VALOR", moeda = "BRL") => ({ origem, valorEstruturado: { tipo: "DINHEIRO" as const, valor: "10.00", moeda } });

describe("validarCoerenciaValoresAditivo", () => {
  it("compara cobertura tipada com a outra ponta da origem", () => {
    expect(() => validarCoerenciaValoresAditivo({ origem, alteracoes: [{ origem: "COBERTURA_INICIO", valorEstruturado: { tipo: "DATA", data: "2027-02-01" } }] })).toThrow(/início/);
    expect(() => validarCoerenciaValoresAditivo({ origem, alteracoes: [{ origem: "COBERTURA_INICIO", valorEstruturado: { tipo: "DATA", data: "2027-01-15" } }, { origem: "COBERTURA_FIM", valorEstruturado: { tipo: "DATA", data: "2027-01-20" } }] })).not.toThrow();
  });

  it("não lê datas de alteração legada ausente", () => {
    expect(() => validarCoerenciaValoresAditivo({ origem: { ...origem, coberturaInicio: "2027-02-01", coberturaFim: "2027-01-01" }, alteracoes: [] })).not.toThrow();
  });

  it("exige as duas pontas resolvidas quando altera cobertura", () => {
    expect(() => validarCoerenciaValoresAditivo({ origem: { ...origem, coberturaFim: null }, alteracoes: [{ origem: "COBERTURA_INICIO", valorEstruturado: { tipo: "DATA", data: "2027-01-15" } }] })).toThrow(/início e fim/);
    expect(() => validarCoerenciaValoresAditivo({ origem: { ...origem, coberturaInicio: null, coberturaFim: null }, alteracoes: [{ origem: "COBERTURA_INICIO", valorEstruturado: { tipo: "DATA", data: "2027-01-15" } }, { origem: "COBERTURA_FIM", valorEstruturado: { tipo: "DATA", data: "2027-01-20" } }] })).not.toThrow();
  });

  it("recusa moeda parcial e aceita decisão completa explícita", () => {
    expect(() => validarCoerenciaValoresAditivo({ origem, alteracoes: [{ origem: "MOEDA", valorEstruturado: { tipo: "MOEDA", moeda: "USD" } }, dinheiro("TAXA_VALOR", "USD")] })).toThrow(/todas as condições/);
    expect(() => validarCoerenciaValoresAditivo({ origem, alteracoes: [{ origem: "MOEDA", valorEstruturado: { tipo: "MOEDA", moeda: "USD" } }, dinheiro("TAXA_VALOR", "USD"), dinheiro("MENSALIDADE_VALOR", "USD")] })).not.toThrow();
  });

  it("exige moeda contratual quando não há proposta nova", () => {
    expect(() => validarCoerenciaValoresAditivo({ origem, alteracoes: [dinheiro("TAXA_VALOR", "USD")] })).toThrow(/moeda contratual/);
  });
});
