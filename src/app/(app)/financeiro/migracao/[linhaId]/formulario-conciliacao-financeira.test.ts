import { describe, expect, it } from "vitest";
import { dataHistoricaComOffset, montarComplementoEstruturado, type CampoComplementoFinanceiro } from "./formulario-conciliacao-financeira";

const campos: CampoComplementoFinanceiro[] = ["tipo", "valor", "moeda", "situacao", "dataPagamento", "forma", "pagadorId"];
const vazio = () => Object.fromEntries(campos.map((campo) => [campo, { motivo: "", evidencia: "" }])) as Record<CampoComplementoFinanceiro, { motivo: string; evidencia: string }>;

describe("formulário de conciliação financeira", () => {
  it("exige deslocamento UTC explícito e preserva o offset informado", () => {
    expect(dataHistoricaComOffset("2026-09-16T09:30", "-03:00")).toBe("2026-09-16T09:30:00-03:00");
    expect(dataHistoricaComOffset("2026-09-16T09:30", "")).toBeNull();
  });
  it.each(["2025-02-29T09:30", "2026-04-31T09:30", "2026-09-16T24:00"])("recusa data civil inexistente %s", (data) => { expect(dataHistoricaComOffset(data, "-03:00")).toBeNull(); });
  it("envia complemento por campo sem inventar os campos ausentes", () => {
    const detalhes = vazio(); detalhes.valor = { motivo: "Fonte traz total diferente do comprovante.", evidencia: "Comprovante 77" };
    const valores = Object.fromEntries(campos.map((campo) => [campo, campo === "valor" ? "120.00" : "x"])) as Record<CampoComplementoFinanceiro, string>;
    expect(montarComplementoEstruturado(detalhes, valores)).toEqual({ itens: [{ campo: "valor", valorProposto: "120.00", motivo: "Fonte traz total diferente do comprovante.", evidencia: { referencia: "Comprovante 77" } }] });
  });
  it("recusa motivo ou evidência isolados", () => {
    const detalhes = vazio(); detalhes.forma = { motivo: "Fonte omite a forma usada.", evidencia: "" };
    const valores = Object.fromEntries(campos.map((campo) => [campo, "x"])) as Record<CampoComplementoFinanceiro, string>;
    expect(() => montarComplementoEstruturado(detalhes, valores)).toThrow("Complemento de forma");
  });
});