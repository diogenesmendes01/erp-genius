"use server";
import ExcelJS from "exceljs";
import { Papel } from "@prisma/client";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { prepararLoteMigracao } from "./acoes";
import { lerCsvPreparacao, linhasMapeadasPreparacao, type AbaPlanilha, type MapeamentoMigracao } from "./planilha";

const LIMITE_BYTES = 5 * 1024 * 1024; const LIMITE_LINHAS = 500;
function texto(valor: ExcelJS.CellValue) { if (valor == null) return null; if (valor instanceof Date) return valor.toISOString().slice(0, 10); if (typeof valor === "object") return "text" in valor && valor.text != null ? String(valor.text) : ""; return typeof valor === "number" ? valor : String(valor); }
async function lerArquivo(file: File, delimitador?: string): Promise<AbaPlanilha[]> {
  if (file.size === 0 || file.size > LIMITE_BYTES) throw new Error("Arquivo ausente ou acima de 5MB.");
  if (/\.csv$/i.test(file.name)) return [lerCsvPreparacao(await file.text(), file.name, delimitador === ";" ? ";" : delimitador === "," ? "," : undefined)];
  if (!/\.xlsx$/i.test(file.name)) throw new Error("Use um arquivo CSV ou XLSX.");
  const livro = new ExcelJS.Workbook(); await livro.xlsx.load(await file.arrayBuffer());
  return livro.worksheets.map((sheet) => { const usados = new Set<string>(); const cabecalhos = Array.from({ length: sheet.getRow(1).cellCount }, (_, indice) => { const base = String(texto(sheet.getRow(1).getCell(indice + 1).value) ?? "").trim() || `Coluna ${indice + 1}`; let rotulo = base, repeticao = 2; while (usados.has(rotulo)) rotulo = `${base} (${repeticao++})`; usados.add(rotulo); return { id: `c${indice + 1}`, rotulo }; }); const linhas = Array.from({ length: Math.min(Math.max(sheet.rowCount - 1, 0), LIMITE_LINHAS) }, (_, indice) => { const numero = indice + 2, row = sheet.getRow(numero), valores = Object.fromEntries(cabecalhos.map((cabecalho, coluna) => { const cell = row.getCell(coluna + 1); return [cabecalho.id, typeof cell.value === "number" ? cell.text : texto(cell.value)]; })); return { numero, valores }; }).filter((linha) => Object.values(linha.valores).some((valor) => valor !== null && valor !== "")); return { nome: sheet.name, cabecalhos, linhas }; });
}
export async function preverArquivoPreparacaoMigracao(form: FormData, delimitador?: "," | ";") { return executarAcao(async () => { await exigirSessaoComPapel(Papel.ADMINISTRADOR); const file = form.get("arquivo"); if (!(file instanceof File)) throw new Error("Selecione um arquivo."); return lerArquivo(file, delimitador); }); }
export async function prepararArquivoMigracao(form: FormData, entrada: { origem: string; chaveLote: string; aba: number; mapeamento: MapeamentoMigracao; tipoEntrada: "CADASTRO" | "VINCULO_MATRICULA" | "FINANCEIRO_HISTORICO" | "HISTORICO_PRESENCA"; delimitador?: "," | ";" }) { return executarAcao(async () => { await exigirSessaoComPapel(Papel.ADMINISTRADOR); const file = form.get("arquivo"); if (!(file instanceof File)) throw new Error("Selecione um arquivo."); const abas = await lerArquivo(file, entrada.delimitador); const aba = abas[entrada.aba]; if (!aba) throw new Error("Aba não encontrada no arquivo."); return prepararLoteMigracao({ origem: entrada.origem, chaveLote: entrada.chaveLote, linhas: linhasMapeadasPreparacao(aba, entrada.mapeamento, entrada.tipoEntrada) }); }); }
