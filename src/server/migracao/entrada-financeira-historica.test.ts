import { describe, expect, it } from "vitest";
import { EntradaFinanceiraHistoricaSchema } from "./entrada-financeira-historica-schema";
import { hashFotografiaFinanceira } from "./fotografia-financeira";

const base = { linhaId: "linha", tipoCobranca: "MENSALIDADE", valor: "120.00", moeda: "CRC", vencimento: "2025-02-10", pagador: { tipo: "RESPONSAVEL", dados: { nome: "Responsável", paisId: "pais" } }, evidencia: { referencia: "planilha!B2" }, chaveIdempotencia: "00000000-0000-4000-8000-000000000001" };
describe("EntradaFinanceiraHistoricaSchema", () => {
  it("preserva proposta sem exigir cobrança ou pagador já criados", () => expect(EntradaFinanceiraHistoricaSchema.parse(base)).toMatchObject({ linhaId: "linha", valor: "120.00" }));
  it("recusa valor, moeda, pagador ou evidência incompletos", () => {
    expect(() => EntradaFinanceiraHistoricaSchema.parse({ ...base, valor: "0,2" })).toThrow();
    expect(() => EntradaFinanceiraHistoricaSchema.parse({ ...base, moeda: "cr" })).toThrow();
    expect(() => EntradaFinanceiraHistoricaSchema.parse({ ...base, pagador: { tipo: "EMPRESA", dados: { nome: "", paisId: "" } } })).toThrow();
    expect(() => EntradaFinanceiraHistoricaSchema.parse({ ...base, evidencia: {} })).toThrow();
  });
  it("inclui campos aninhados no hash canônico", () => {
    expect(hashFotografiaFinanceira(base)).not.toBe(hashFotografiaFinanceira({ ...base, pagador: { ...base.pagador, dados: { ...base.pagador.dados, nome: "Outra pessoa" } } }));
    expect(hashFotografiaFinanceira(base)).not.toBe(hashFotografiaFinanceira({ ...base, evidencia: { referencia: "f!3" } }));
  });
});
