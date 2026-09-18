import { describe, expect, it } from "vitest";
import { LinhaImpactoCoberturaAditivoSchema } from "./aditivo-cobertura-schema";

const linha = {
  cobrancaId: "mensalidade",
  classificacao: "AFETADA",
  coberturaInicioNova: "2028-02-01",
  coberturaFimNova: "2028-02-29",
  justificativa: "Correção conforme o aditivo assinado.",
};

describe("datas civis do acerto de cobertura", () => {
  it("aceita fevereiro bissexto sem deslocar os limites", () => {
    expect(LinhaImpactoCoberturaAditivoSchema.parse(linha)).toEqual(linha);
  });
  it.each(["2027-02-29", "2028-02-30", "2028-04-31", "2028-13-01"])("recusa %s antes de converter para Date", data => {
    expect(LinhaImpactoCoberturaAditivoSchema.safeParse({ ...linha, coberturaFimNova: data }).success).toBe(false);
  });
  it("recusa intervalo invertido e mudança em mensalidade preservada", () => {
    expect(LinhaImpactoCoberturaAditivoSchema.safeParse({ ...linha, coberturaFimNova: "2028-01-31" }).success).toBe(false);
    expect(LinhaImpactoCoberturaAditivoSchema.safeParse({ ...linha, classificacao: "PRESERVADA" }).success).toBe(false);
  });
});
