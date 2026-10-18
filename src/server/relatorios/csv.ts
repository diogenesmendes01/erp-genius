/** Neutraliza injeção de fórmula: texto que começa com = + - @, tab ou CR ganha o prefixo `'`. Número vai como está. */
export function celulaSegura(v: string | number | null): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

const aspas = (s: string) => (/[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** CSV para planilha em pt-BR: separador `;`, BOM UTF-8, CRLF, aspas duplicadas e células neutralizadas contra fórmula. */
export function gerarCsv(colunas: string[], linhas: (string | number | null)[][]): string {
  const linha = (cs: (string | number | null)[]) => cs.map((c) => aspas(celulaSegura(c))).join(";");
  return `﻿${[linha(colunas), ...linhas.map(linha)].join("\r\n")}\r\n`;
}
