// Extrai os achados da seção 6 de docs/42-auditoria-frontend-ux.md.
// Uso: node scripts/medicao-ux/achados.mjs [--sev Alta|Media|Baixa] [--json] [--resumo]
import { readFileSync } from "node:fs";

const doc = readFileSync(new URL("../../docs/42-auditoria-frontend-ux.md", import.meta.url), "utf8").split(/\r?\n/);
const ini = doc.findIndex((l) => l.startsWith("## 6."));
const fim = doc.findIndex((l) => l.startsWith("## 7."));

export const achados = [];
let area = "";
let rota = "";
for (let i = ini; i < fim; i++) {
  const l = doc[i];
  if (l.startsWith("### ")) area = l.slice(4).trim();
  else if (l.startsWith("#### ")) rota = l.slice(5).replace(/`/g, "").trim();
  else {
    const m = l.match(/^\| (\d+) \| (Alta|Media|Média|Baixa) \| (.*)$/);
    if (!m) continue;
    // separa colunas por " | " que não esteja escapado como \|
    const resto = m[3]
      .replace(/\\\|/g, "\u0000")
      .split(" | ")
      .map((c) => c.replace(/\u0000/g, "\\|").replace(/ ?\|$/, "").trim());
    achados.push({
      linha: i + 1,
      area,
      rota,
      n: Number(m[1]),
      sev: m[2] === "Média" ? "Media" : m[2],
      categoria: resto[0],
      problema: resto[1],
      evidencia: resto[2],
      recomendacao: resto[3],
    });
  }
}

const args = process.argv.slice(2);
if (/achados\.mjs$/.test(process.argv[1] ?? "")) {
  const sevIdx = args.indexOf("--sev");
  const filtrados = sevIdx >= 0 ? achados.filter((a) => a.sev === args[sevIdx + 1]) : achados;
  if (args.includes("--resumo")) {
    const porArea = {};
    for (const a of achados) {
      porArea[a.area] ??= { Alta: 0, Media: 0, Baixa: 0 };
      porArea[a.area][a.sev]++;
    }
    console.table(porArea);
    console.log("total", achados.length);
  } else if (args.includes("--json")) {
    console.log(JSON.stringify(filtrados, null, 1));
  } else {
    for (const a of filtrados) console.log(`${a.linha}\t${a.area}\t${a.rota}\t#${a.n}\t${a.sev}\t${a.categoria}`);
  }
}
