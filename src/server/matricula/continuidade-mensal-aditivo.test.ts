import { describe, expect, it } from "vitest";
import { planejarContinuidadeMensalAposAditivo } from "./continuidade-mensal";
import type { EntradaPlanejarContinuidadeMensal } from "./continuidade-mensal-schema";
const dados: EntradaPlanejarContinuidadeMensal = {
  continuidadeContratada: { contratada: true, clausula: "Continuidade contratada", evidenciaId: "doc" },
  regraCobertura: { referencia: "MES_CIVIL" }, ultimaCobertura: { inicio: "2026-10-01", fim: "2026-11-05" },
  diaVencimento: 10, referenciaVencimento: "MES_COBERTURA", antecedenciaDias: 5,
  valorOriginal: "300.00", valorNegociado: "250.00", moeda: "BRL", vigenteDesde: "2026-01-01",
  ajusteVencimento: "MANTER_DATA", dataPlanejamento: "2026-11-01",
};
const prova = { conjuntoId: "conjunto", versaoCondicoesId: "versao", decisaoId: "decisao", regraAplicada: { referencia: "CICLO_MATRICULA", dataReferencia: "2026-11-06" } };
describe("continuidade após cobertura corrigida por aditivo", () => {
  it("começa após o período corrigido e registra a origem da regra", () => {
    const plano = planejarContinuidadeMensalAposAditivo(dados, prova);
    expect(plano).toMatchObject({ cobertura: { inicio: "2026-11-06", fim: "2026-12-05" }, vencimento: "2026-11-10", valorNegociado: "250.00", memoriaCobertura: { origemAditivo: prova } });
    expect(dados.ultimaCobertura.fim).toBe("2026-11-05");
  });
  it("preserva mês civil quando a cobertura corrigida termina na fronteira adequada", () => {
    expect(planejarContinuidadeMensalAposAditivo({ ...dados, ultimaCobertura: { inicio: "2026-10-10", fim: "2026-10-31" } }, { ...prova, regraAplicada: { referencia: "MES_CIVIL" } }).cobertura).toMatchObject({ inicio: "2026-11-01", fim: "2026-11-30" });
  });
  it("recusa referência que cobraria dias já cobertos", () => {
    expect(() => planejarContinuidadeMensalAposAditivo(dados, { ...prova, regraAplicada: { referencia: "MES_CIVIL" } })).toThrow("sobreposição");
  });
  it("mantém a âncora nos períodos seguintes inclusive fevereiro", () => {
    const primeiro = planejarContinuidadeMensalAposAditivo({ ...dados, ultimaCobertura: { inicio: "2026-12-31", fim: "2027-01-30" } }, { ...prova, regraAplicada: { referencia: "CICLO_MATRICULA", dataReferencia: "2026-12-31" } });
    const segundo = planejarContinuidadeMensalAposAditivo({ ...dados, ultimaCobertura: { inicio: primeiro.cobertura.inicio, fim: primeiro.cobertura.fim } }, { ...prova, regraAplicada: { referencia: "CICLO_MATRICULA", dataReferencia: "2026-12-31" } });
    expect(primeiro.cobertura).toMatchObject({ inicio: "2027-01-31", fim: "2027-02-27" });
    expect(segundo.cobertura).toMatchObject({ inicio: "2027-02-28", fim: "2027-03-30" });
  });
});
