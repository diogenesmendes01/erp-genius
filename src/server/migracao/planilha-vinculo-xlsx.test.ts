import ExcelJS from "exceljs";
import { expect, it } from "vitest";
import { lerArquivoPreparacao } from "./planilha-leitura";
import { linhasMapeadasPreparacao } from "./planilha";
import { pendenciasDaLinha } from "./preparacao";

it("lê XLSX real de vínculo, preserva datas e aponta data impossível em texto", async () => {
  const livro = new ExcelJS.Workbook(); const aba = livro.addWorksheet("Vínculos");
  ["aluno", "turma", "matricula", "inicio", "fim", "produto", "moeda", "pais", "alocInicio", "alocFim"].forEach((v, i) => aba.getCell(1, i + 1).value = v);
  aba.getCell("A2").value = "001"; aba.getCell("B2").value = "T-1"; aba.getCell("C2").value = "M-1"; aba.getCell("D2").value = new Date(Date.UTC(2024, 1, 29)); aba.getCell("E2").value = new Date(Date.UTC(2024, 2, 1)); aba.getCell("F2").value = "OFERTA-01"; aba.getCell("G2").value = "BRL"; aba.getCell("H2").value = "BR"; aba.getCell("I2").value = "2024-02-30"; aba.getCell("J2").value = "2024-02-01";
  const arquivo = new File([new Uint8Array(await livro.xlsx.writeBuffer())], "vinculos.xlsx");
  const [lida] = await lerArquivoPreparacao(arquivo);
  const [linha] = linhasMapeadasPreparacao(lida!, { "aluno.id": "c1", "turma.id": "c2", "matricula.id": "c3", "matricula.inicio": "c4", "matricula.fim": "c5", "matricula.produtoOrigem": "c6", "matricula.moeda": "c7", "matricula.pais": "c8", "alocacao.inicio": "c9", "alocacao.fim": "c10" }, "VINCULO_MATRICULA");
  expect(linha?.matricula?.inicio).toBe("2024-02-29"); expect(linha?.alocacao?.inicio).toBe("2024-02-30");
  expect(pendenciasDaLinha(linha!).map((p) => p.codigo)).toContain("INICIO_ALOCACAO_INVALIDO");
});
