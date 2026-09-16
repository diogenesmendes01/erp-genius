import { expect, it } from "vitest";
import { calcularCompensacaoPendenteEncerramento } from "./encerramento-compensacao";
const entrada = () => ({ matriculaId: "m1", condicoesId: "v1", cobrancaOrigemId: "c1", compensacaoId: "comp1", moeda: "BRL",
  coberturaOriginalInicio: "2028-02-01", coberturaOriginalFim: "2028-02-29", valorCoberturaOriginalConferido: "290.00",
  regraCalculo: "DIAS_REAIS_PERIODO_ORIGEM" as const, evidenciaCondicoes: "Conferidos contrato, desconto e cobertura originais",
  diasIndisponiveis: ["2028-02-10", "2028-02-11", "2028-02-12"], diasRecompostos: ["2028-02-10"],
  diasLiquidadosFinanceiramente: [] as string[], diasContempladosNoProporcional: [] as string[],
});
it("apura somente dois dias quando um dos três devidos já foi recomposto", () => {
  const d = entrada(); const copia = structuredClone(d);
  const r = calcularCompensacaoPendenteEncerramento(d);
  expect(r).toMatchObject({ quantidadePendente: 2, valorAjusteApurado: "20.00", memoria: { diasPeriodoOriginal: 29 } });
  expect(r.diasPendentes).toEqual(["2028-02-11", "2028-02-12"]);
  expect(d).toEqual(copia);
  expect(r).not.toHaveProperty("creditoApurado");
});
it("exclui dias já ajustados e dias contemplados pelo proporcional", () => {
  const r = calcularCompensacaoPendenteEncerramento({ ...entrada(), diasLiquidadosFinanceiramente: ["2028-02-11"], diasContempladosNoProporcional: ["2028-02-12"] });
  expect(r.quantidadePendente).toBe(0); expect(r.valorAjusteApurado).toBe("0.00");
});
it("rejeita duplicação, destinações conflitantes e datas sem origem", () => {
  expect(() => calcularCompensacaoPendenteEncerramento({ ...entrada(), diasRecompostos: ["2028-02-10", "2028-02-10"] })).toThrow(/repetido/);
  expect(() => calcularCompensacaoPendenteEncerramento({ ...entrada(), diasLiquidadosFinanceiramente: ["2028-02-10"] })).toThrow(/destinação/);
  expect(() => calcularCompensacaoPendenteEncerramento({ ...entrada(), diasRecompostos: ["2028-02-09"] })).toThrow(/origem/);
  expect(() => calcularCompensacaoPendenteEncerramento({ ...entrada(), diasIndisponiveis: ["2028-03-01"], diasRecompostos: [] })).toThrow(/fora/);
});
it("arredonda o conjunto de dias uma vez, sem somar diárias arredondadas", () => {
  const r = calcularCompensacaoPendenteEncerramento({ ...entrada(), valorCoberturaOriginalConferido: "10" });
  expect(r.valorAjusteApurado).toBe("0.69"); // Duas diárias arredondadas isoladamente dariam 0,68.
  expect(r.memoria.valorCoberturaOriginal).toBe("10.00");
});
