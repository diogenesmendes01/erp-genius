import { describe, expect, it } from "vitest";
import { MENSAGEM_REGIME_NOVA_CONTRATACAO, validarCoerenciaValoresAditivo } from "./aditivo-coerencia";

const origem = { moeda: "BRL", coberturaInicio: "2027-01-01", coberturaFim: "2027-01-31", fontesMonetarias: ["TAXA_VALOR", "MENSALIDADE_VALOR"] as const };

describe("Q174 — mudança de regime é nova contratação", () => {
  it("recusa o aditivo de regime já na proposta, sozinho ou acompanhado, com orientação", () => {
    const regime = { origem: "REGIME" as const, valorEstruturado: { tipo: "REGIME" as const, regime: "HORA_PARTICULAR" as const } };
    expect(() => validarCoerenciaValoresAditivo({ origem, alteracoes: [regime] })).toThrow(MENSAGEM_REGIME_NOVA_CONTRATACAO);
    expect(() => validarCoerenciaValoresAditivo({ origem, alteracoes: [regime, { origem: "MENSALIDADE_VALOR", valorEstruturado: { tipo: "DINHEIRO", valor: "10.00", moeda: "BRL" } }] })).toThrow(/nova negociação/);
  });
  it("demais alterações continuam aceitas", () => {
    expect(() => validarCoerenciaValoresAditivo({ origem, alteracoes: [{ origem: "MENSALIDADE_VALOR", valorEstruturado: { tipo: "DINHEIRO", valor: "10.00", moeda: "BRL" } }] })).not.toThrow();
  });
});
