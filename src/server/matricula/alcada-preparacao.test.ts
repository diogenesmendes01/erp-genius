import { describe, expect, it } from "vitest";
import { conferirAlcadaPreparacao } from "./alcada-preparacao";
const base = { regime: "MENSALIDADE" as const, moeda: "CRC", taxa: "90", servico: "160", limiteTaxa: "10", limiteMensalidade: "15", referencias: [{ tipoCobranca: "MATRICULA", valor: "100", moeda: "CRC" }, { tipoCobranca: "MENSALIDADE", valor: "200", moeda: "CRC" }] };
describe("alçada da proposta", () => {
  it("separa componentes e considera desconto acumulado contra a referência", () => {
    expect(conferirAlcadaPreparacao(base).componentes).toMatchObject([{ descontoPct: "10", resultado: "DENTRO_ALCADA" }, { descontoPct: "20", resultado: "EXIGE_APROVACAO" }]);
    expect(conferirAlcadaPreparacao({ ...base, taxa: "89.99" }).componentes[0]).toMatchObject({ descontoPct: "10.01", resultado: "EXIGE_APROVACAO" });
  });
  it("não aproveita limite mensal para particulares por hora", () => {
    const referencias = [base.referencias[0], { tipoCobranca: "HORA_PARTICULAR", valor: "200", moeda: "CRC" }];
    expect(conferirAlcadaPreparacao({ ...base, regime: "HORA_PARTICULAR", limiteMensalidade: "100", referencias }).componentes[1]).toMatchObject({ limitePct: null, resultado: "EXIGE_APROVACAO" });
  });
  it("exige conferência quando falta referência, há duplicidade ou moeda divergente", () => {
    for (const referencias of [[], [base.referencias[0], base.referencias[0]], [{ ...base.referencias[0], moeda: "USD" }]]) {
      expect(conferirAlcadaPreparacao({ ...base, referencias }).componentes[0]).toMatchObject({ referencia: null, resultado: "REFERENCIA_INSUFICIENTE" });
    }
  });
});
