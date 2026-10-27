export function celulaSegura(v: string | number | null): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

const aspas = (s: string) => (/[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function gerarCsv(colunas: string[], linhas: (string | number | null)[][]): string {
  const linha = (cs: (string | number | null)[]) => cs.map((c) => aspas(celulaSegura(c))).join(";");
  return `﻿${[linha(colunas), ...linhas.map(linha)].join("\r\n")}\r\n`;
}
