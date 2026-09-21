import { expect, it } from "vitest";
import { planejarCobrancasEntrada as planejar } from "./plano-cobrancas-entrada";
const base = { moeda: "CRC", taxaProposta: "100", valorServicoProposto: "200", taxaVencimento: "2026-10-05", politicaEntrada: { taxaPreviaAssinatura: true, exigirPrimeiraMensalidade: false, adiantamentoHoraExigido: false }, adiantamentoProposto: null,
  aulas: { regime: "MENSALIDADE", cobertura: { referencia: "MES_CIVIL", inicio: "2026-10-01" }, primeiroVencimento: "2026-10-10", diaVencimentoContratado: 10 } };
it.each([true, false])("mensalidade exigida=%s determina o momento, preservando cobertura e valor integral", (exigir) => {
  const r = planejar({ ...base, politicaEntrada: { ...base.politicaEntrada, exigirPrimeiraMensalidade: exigir } });
  expect(r).toHaveLength(2); expect(r[0]).toMatchObject({ tipo: "MATRICULA", etapa: "CONFERENCIA_SECRETARIA", valor: "100" });
  expect(r[1]).toMatchObject({ tipo: "MENSALIDADE", etapa: exigir ? "CONFERENCIA_SECRETARIA" : "ATIVACAO", valor: "200", cobertura: { inicio: "2026-10-01", fim: "2026-10-31", dias: 31 } });
});
it("hora posterior ao fechamento não cria mensalidade nem adiantamento", () => {
  expect(planejar({ ...base, aulas: { regime: "HORA_PARTICULAR" } }).map((c) => c.tipo)).toEqual(["MATRICULA"]);
});
it("antecipação usa valor/tempo identificados e rejeita divergências", () => {
  const d = { ...base, aulas: { regime: "HORA_PARTICULAR", vencimentoAdiantamento: "2026-10-06" }, adiantamentoProposto: { minutos: 75, valorHora: "200", valor: "250", unidadeMinutos: 60 } };
  expect(planejar(d)[1]).toMatchObject({ tipo: "HORA_PARTICULAR", minutos: 75, valor: "250.00", etapa: "CONFERENCIA_SECRETARIA" });
  expect(() => planejar({ ...d, adiantamentoProposto: { ...d.adiantamentoProposto, valor: "200" } })).toThrow("difere");
  expect(() => planejar({ ...d, aulas: { regime: "HORA_PARTICULAR" } })).toThrow("difere");
});
it("regra incompleta não presume emissão", () => {
  expect(() => planejar({ ...base, politicaEntrada: {} })).toThrow("insuficientes");
  expect(() => planejar({ ...base, aulas: { regime: "HORA_PARTICULAR" }, politicaEntrada: { ...base.politicaEntrada, adiantamentoHoraExigido: true } })).toThrow("antecipação");
});
