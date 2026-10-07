// Extrai os achados das tabelas da seção 6 de docs/42-auditoria-frontend-ux.md.
// Uso: node scripts/medicao-ux/achados.mjs [--sev Alta|Media|Baixa] [--json] [--resumo]
// ("Média", com acento, também é aceito; qualquer outro valor é erro).
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { normalizarSeveridade } from "./nucleo.mjs";

export const CAMINHO_DOC_42 = new URL("../../docs/42-auditoria-frontend-ux.md", import.meta.url);

/**
 * Achados em tabela da seção 6: área = último "### ", rota = último "#### ", linha = número da
 * linha no documento (1-based).
 * @param {string} texto conteúdo do doc 42
 */
export function extrairAchados(texto) {
  const doc = texto.split(/\r?\n/);
  const ini = doc.findIndex((l) => l.startsWith("## 6."));
  const fim = doc.findIndex((l) => l.startsWith("## 7."));
  if (ini < 0 || fim < 0) throw new Error("doc 42 sem as seções 6 e 7");
  const achados = [];
  let area = "";
  let rota = "";
  for (let i = ini; i < fim; i++) {
    const l = doc[i];
    if (l.startsWith("#### ")) rota = l.slice(5).replace(/`/g, "").trim();
    else if (l.startsWith("### ")) area = l.slice(4).trim();
    else {
      const m = l.match(/^\| (\d+) \| (Alta|Media|Média|Baixa) \| (.*)$/);
      if (!m) continue;
      // colunas separadas por " | " que não esteja escapado como \|
      const resto = m[3]
        .replace(/\\\|/g, "\u0000")
        .split(" | ")
        .map((c) => c.replace(/\u0000/g, "\\|").replace(/ ?\|$/, "").trim());
      achados.push({
        linha: i + 1,
        area,
        rota,
        n: Number(m[1]),
        sev: normalizarSeveridade(m[2]),
        categoria: resto[0],
        problema: resto[1],
        evidencia: resto[2],
        recomendacao: resto[3],
      });
    }
  }
  return achados;
}

/** Contagem por área e severidade. */
export function resumoPorArea(achados) {
  const porArea = {};
  for (const a of achados) {
    porArea[a.area] ??= { Alta: 0, Media: 0, Baixa: 0 };
    porArea[a.area][a.sev]++;
  }
  return porArea;
}

/** Achados do doc 42 do repositório. */
export const achadosDoRepositorio = () => extrairAchados(readFileSync(CAMINHO_DOC_42, "utf8"));

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  try {
    const todos = achadosDoRepositorio();
    const i = args.indexOf("--sev");
    const filtrados = i >= 0 ? todos.filter((a) => a.sev === normalizarSeveridade(args[i + 1])) : todos;
    if (args.includes("--resumo")) {
      console.table(resumoPorArea(todos));
      console.log("total", todos.length);
    } else if (args.includes("--json")) console.log(JSON.stringify(filtrados, null, 1));
    else for (const a of filtrados) console.log(`${a.linha}\t${a.area}\t${a.rota}\t#${a.n}\t${a.sev}\t${a.categoria}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
