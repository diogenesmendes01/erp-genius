import { describe, expect, it } from "vitest";
import { prepararCoberturasRetomada, type EntradaRetomadaCobertura } from "./retomada-cobertura";
const base = (): EntradaRetomadaCobertura => ({ retorno: "2026-11-15", regra: { referencia: "MES_CIVIL" }, mantidos: [],
  suspensos: [
    { cobrancaId: "outubro", cobertura: { inicio: "2026-10-01", fim: "2026-10-31" }, vencimento: "2026-10-05" },
    { cobrancaId: "novembro", cobertura: { inicio: "2026-11-01", fim: "2026-11-30" }, vencimento: "2026-11-05" },
  ], vencimentos: { opcao: "MANTER_VENCIMENTOS" },
});
describe("cobertura e vencimento independentes na retomada Q66", () => {
  it("reprograma cobertura desde retorno e conserva vencimentos originais", () => {
    const dados = base();
    const resultado = prepararCoberturasRetomada(dados);
    expect(resultado.map((r) => r.cobertura)).toEqual([{ inicio: "2026-11-15", fim: "2026-11-30" }, { inicio: "2026-12-01", fim: "2026-12-31" }]);
    expect(resultado.map((r) => r.vencimento)).toEqual(["2026-10-05", "2026-11-05"]);
    expect(dados).toEqual(base());
  });
  it("mudar vencimentos não muda a cobertura calculada", () => {
    const dados = base();
    const original = prepararCoberturasRetomada(dados);
    dados.vencimentos = { opcao: "REPROGRAMAR_PARCELAS", datas: [{ cobrancaId: "novembro", vencimento: "2026-12-10" }, { cobrancaId: "outubro", vencimento: "2026-11-20" }] };
    const novo = prepararCoberturasRetomada(dados);
    expect(novo.map((r) => r.cobertura)).toEqual(original.map((r) => r.cobertura));
    expect(novo.map((r) => r.vencimento)).toEqual(["2026-11-20", "2026-12-10"]);
  });
  it("retorno dentro de período preservado começa a nova cobertura depois dele", () => {
    const dados = base();
    dados.mantidos = [{ inicio: "2026-11-01", fim: "2026-11-30" }];
    expect(prepararCoberturasRetomada(dados)[0].cobertura).toEqual({ inicio: "2026-12-01", fim: "2026-12-31" });
  });
  it("preserva referência 31 no ciclo, inclusive depois de fevereiro", () => {
    const dados = base();
    dados.retorno = "2027-02-20";
    dados.regra = { referencia: "CICLO_MATRICULA", dataReferencia: "2026-01-31" };
    expect(prepararCoberturasRetomada(dados).map((r) => r.cobertura)).toEqual([{ inicio: "2027-02-20", fim: "2027-02-27" }, { inicio: "2027-02-28", fim: "2027-03-30" }]);
  });
  it("recusa sobreposição em períodos mantidos", () => {
    const dados = base();
    dados.mantidos = [{ inicio: "2026-12-10", fim: "2026-12-20" }];
    expect(() => prepararCoberturasRetomada(dados)).toThrow("conflita");
  });
  it("exige vencimentos exatamente para os contratos selecionados", () => {
    const dados = base();
    dados.vencimentos = { opcao: "REPROGRAMAR_PARCELAS", datas: [] };
    expect(() => prepararCoberturasRetomada(dados)).toThrow("cada cobrança");
    dados.vencimentos.datas = [{ cobrancaId: "alheia", vencimento: "2026-12-05" }];
    expect(() => prepararCoberturasRetomada(dados)).toThrow("fora da seleção");
  });
});
