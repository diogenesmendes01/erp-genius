import { expect, it } from "vitest";
import { planejarContinuidadeComVencimentoFinanceiro, PlanejarContinuidadeFinanceiraSchema } from "./continuidade-vencimento-financeiro";
import { z } from "zod";

const entrada = (): z.input<typeof PlanejarContinuidadeFinanceiraSchema> => ({
  continuidadeContratada: { contratada: true, clausula: "Continuidade contratada", evidenciaId: "contrato" },
  regraCobertura: { referencia: "MES_CIVIL" },
  ultimaCobertura: { inicio: "2026-01-01", fim: "2026-01-31" },
  diaVencimento: 31, referenciaVencimento: "MES_COBERTURA", antecedenciaDias: 5,
  valorOriginal: "300", valorNegociado: "250", moeda: "BRL", vigenteDesde: "2026-01-01",
  dataPlanejamento: "2026-02-24",
  regraVencimento: { regra: "PROXIMO_DIA_UTIL", calendario: {
    id: "financeiro", versao: 2, referencia: "Referência contratual de teste",
    inicioVigencia: "2026-01-01", fimVigencia: "2026-12-31",
    diasSemanaUteis: [1, 2, 3, 4, 5], feriados: [],
  } },
});

it("ajusta fevereiro para março sem mudar cobertura, preço ou antecipar emissão pela data original", () => {
  const dados = entrada();
  const copia = structuredClone(dados);
  expect(planejarContinuidadeComVencimentoFinanceiro(dados)).toMatchObject({
    cobertura: { inicio: "2026-02-01", fim: "2026-02-28" },
    vencimento: "2026-03-02", emissaoEm: "2026-02-25", status: "AGUARDAR_EMISSAO",
    valorNegociado: "250", memoriaVencimento: { dataCalculada: "2026-02-28", dataAjustada: "2026-03-02", referenciaCalendarioAplicada: { id: "financeiro", versao: 2 } },
  });
  expect(dados).toEqual(copia);
  expect(planejarContinuidadeComVencimentoFinanceiro({ ...dados, dataPlanejamento: "2026-02-25" }).status).toBe("PRONTA_PARA_EMISSAO");
});

it("manter data não presume fim de semana financeiro", () => {
  expect(planejarContinuidadeComVencimentoFinanceiro({ ...entrada(), regraVencimento: { regra: "MANTER_DATA" } })).toMatchObject({
    vencimento: "2026-02-28", emissaoEm: "2026-02-23", memoriaVencimento: { referenciaCalendarioAplicada: null },
  });
});

it("aplica referência do mês anterior antes de conferir feriados financeiros", () => {
  const dados = entrada();
  if (dados.regraVencimento.regra !== "PROXIMO_DIA_UTIL") throw new Error("fixture");
  dados.regraVencimento.calendario.feriados = ["2026-02-02"];
  expect(planejarContinuidadeComVencimentoFinanceiro({ ...dados, referenciaVencimento: "MES_ANTERIOR" })).toMatchObject({
    cobertura: { inicio: "2026-02-01", fim: "2026-02-28" }, vencimento: "2026-02-03",
    memoriaVencimento: { dataCalculada: "2026-01-31" },
  });
});

it("não inventa calendário quando a referência não cobre o próximo dia útil", () => {
  const dados = entrada();
  if (dados.regraVencimento.regra !== "PROXIMO_DIA_UTIL") throw new Error("fixture");
  dados.regraVencimento.calendario.fimVigencia = "2026-02-28";
  expect(() => planejarContinuidadeComVencimentoFinanceiro(dados)).toThrow(/dia útil/);
});

it("não usa a regra financeira para aceitar cobertura irregular nem data de emissão fora do intervalo", () => {
  expect(() => planejarContinuidadeComVencimentoFinanceiro({ ...entrada(), ultimaCobertura: { inicio: "2026-01-05", fim: "2026-01-31" } })).toThrow(/cobertura/);
  expect(() => planejarContinuidadeComVencimentoFinanceiro({ ...entrada(), antecedenciaDias: Number.MAX_SAFE_INTEGER })).toThrow();
});
