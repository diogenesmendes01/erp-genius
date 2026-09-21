import { expect, it } from "vitest";
import { extrairOrigemEstruturadaAditivo } from "./aditivo-origem-estruturada";

const mensalidade = {
  condicoes: { moeda: "BRL", taxaProposta: "100", valorServicoProposto: "200", taxaVencimento: "2099-10-01",
    politicaEntrada: { taxaPreviaAssinatura: false, exigirPrimeiraMensalidade: true, adiantamentoHoraExigido: null }, adiantamentoProposto: null,
    aulas: { regime: "MENSALIDADE", cobertura: { referencia: "MES_CIVIL", inicio: "2099-10-01" }, primeiroVencimento: "2099-10-05", diaVencimentoContratado: 5 } },
  documento: { campos: [{ origem: "MOEDA", valor: "USD" }, { origem: "COBERTURA_INICIO", valor: "texto adulterado" }] },
};

it("extrai mensalidade, moeda e cobertura apenas das condições preservadas", () => {
  expect(extrairOrigemEstruturadaAditivo(mensalidade)).toEqual({ moeda: "BRL", coberturaInicio: "2099-10-01", coberturaFim: "2099-10-31",
    fontesMonetarias: ["TAXA_VALOR", "MENSALIDADE_VALOR"] });
});

it("interpreta contratação por hora com e sem adiantamento", () => {
  const base = { condicoes: { moeda: "CRC", taxaProposta: "100", valorServicoProposto: "80", taxaVencimento: "2099-10-01",
    politicaEntrada: { taxaPreviaAssinatura: false, exigirPrimeiraMensalidade: null, adiantamentoHoraExigido: false }, adiantamentoProposto: null,
    aulas: { regime: "HORA_PARTICULAR" } } };
  expect(extrairOrigemEstruturadaAditivo(base)).toEqual({ moeda: "CRC", coberturaInicio: null, coberturaFim: null,
    fontesMonetarias: ["TAXA_VALOR", "HORA_VALOR"] });
  const comAdiantamento = { condicoes: { ...base.condicoes, adiantamentoProposto: { minutos: 75, valor: "100", valorHora: "80", unidadeMinutos: 60 },
    aulas: { regime: "HORA_PARTICULAR", vencimentoAdiantamento: "2099-10-02" } } };
  expect(extrairOrigemEstruturadaAditivo(comAdiantamento).fontesMonetarias).toEqual(["TAXA_VALOR", "HORA_VALOR", "ADIANTAMENTO_VALOR"]);
});

it("recusa prévia sem condições preservadas ou condições incompletas", () => {
  expect(() => extrairOrigemEstruturadaAditivo({ documento: { campos: [] } })).toThrow("não preserva condições");
  expect(() => extrairOrigemEstruturadaAditivo({ condicoes: { moeda: "BRL" } })).toThrow("insuficientes");
});
