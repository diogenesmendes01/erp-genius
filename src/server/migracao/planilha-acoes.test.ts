import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { lerArquivoPreparacao } from "./planilha-leitura";

async function arquivo(livro: ExcelJS.Workbook, nome = "origem.xlsx") { return new File([new Uint8Array(await livro.xlsx.writeBuffer())], nome, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); }
describe("leitura XLSX de preparação", () => {
  it("preserva aba escolhível, coluna posterior, fórmula, richText e data", async () => {
    const livro = new ExcelJS.Workbook(); const primeira = livro.addWorksheet("Primeira"); primeira.getCell("A1").value = "id"; primeira.getCell("C1").value = "extra"; primeira.getCell("C2").value = "depois do cabeçalho"; const segunda = livro.addWorksheet("Histórico"); segunda.getCell("A1").value = "id"; segunda.getCell("B1").value = "formula"; segunda.getCell("C1").value = "texto"; segunda.getCell("D1").value = "data"; segunda.getCell("A2").value = "00123"; segunda.getCell("B2").value = { formula: "1+1", result: 2 }; segunda.getCell("C2").value = { richText: [{ text: "á" }, { text: "rea" }] }; segunda.getCell("D2").value = new Date("2026-09-16T00:00:00Z");
    const abas = await lerArquivoPreparacao(await arquivo(livro));
    expect(abas).toHaveLength(2); expect(abas[0]?.cabecalhos.map((c) => c.rotulo)).toEqual(["id", "Coluna 2", "extra"]);
    expect(abas[1]?.linhas[0]?.valores).toMatchObject({ c1: "00123", c2: "fórmula: 1+1; resultado: 2", c3: "área", c4: "2026-09-16" });
  });
  it("rejeita aba acima do limite sem criar fotografia parcial", async () => {
    const livro = new ExcelJS.Workbook(); const aba = livro.addWorksheet("Muitas"); aba.getCell("A1").value = "id"; for (let indice = 2; indice <= 502; indice++) aba.getCell(indice, 1).value = String(indice);
    await expect(lerArquivoPreparacao(await arquivo(livro))).rejects.toThrow(/500 linhas/i);
  });
});
