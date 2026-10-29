import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const LABEL_CONTRATO = "migration-contract";
export const REF_BASE = "origin/main";
export const ARGUMENTOS_DIFF = ["diff", "--name-only", REF_BASE, "--", "prisma/migrations"] as const;

export type RegraMigracao =
  | "DROP TABLE"
  | "DROP COLUMN"
  | "RENAME"
  | "ALTER COLUMN TYPE"
  | "SET NOT NULL";

export type ViolacaoMigracao = {
  regra: RegraMigracao;
  linha: number;
  trecho: string;
};

export type ResultadoLint = {
  ok: boolean;
  violacoes: Array<ViolacaoMigracao & { caminho: string }>;
};

const ORDEM: RegraMigracao[] = ["DROP TABLE", "DROP COLUMN", "RENAME", "ALTER COLUMN TYPE", "SET NOT NULL"];

const PADROES: { regra: RegraMigracao; re: RegExp; soSemDefault?: boolean }[] = [
  { regra: "DROP TABLE", re: /\bDROP\s+TABLE\b/gi },
  { regra: "DROP COLUMN", re: /\bDROP\s+COLUMN\b/gi },
  { regra: "RENAME", re: /\bRENAME\b/gi },
  {
    regra: "ALTER COLUMN TYPE",
    re: /\bALTER\s+COLUMN\s+(?:"[^"]+"|[A-Za-z_][\w$]*)\s+(?:SET\s+DATA\s+)?TYPE\b/gi,
  },
  { regra: "SET NOT NULL", re: /\bSET\s+NOT\s+NULL\b/gi, soSemDefault: true },
];

const CAMINHO_MIGRATION = /^prisma\/migrations\/[^/]+\/migration\.sql$/;

function normalizar(sql: string): string {
  return sql.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function tagEm(src: string, pos: number): { raw: string; end: number } | null {
  if (src[pos] !== "$") return null;
  if (src[pos + 1] === "$") return { raw: "$$", end: pos + 2 };
  const encontrado = /^\$([A-Za-z_][A-Za-z0-9_]*)\$/.exec(src.slice(pos));
  if (!encontrado) return null;
  return { raw: encontrado[0], end: pos + encontrado[0].length };
}

/** Apaga comentários e literais, preservando quebras de linha. `;` dentro de `$...$` não separa comando. */
function preparar(sql: string): { visivel: string; separadores: number[] } {
  const src = normalizar(sql);
  const chars = src.split("");
  const separadores: number[] = [];
  const dolar: string[] = [];
  const n = chars.length;
  let i = 0;

  const apagar = (de: number, ate: number) => {
    for (let j = de; j < ate; j++) if (chars[j] !== "\n") chars[j] = " ";
  };

  while (i < n) {
    const c = chars[i];
    const prox = chars[i + 1];
    if (c === "-" && prox === "-") {
      const inicio = i;
      while (i < n && chars[i] !== "\n") i++;
      apagar(inicio, i);
      continue;
    }
    if (c === "/" && prox === "*") {
      let profundidade = 1;
      apagar(i, i + 2);
      i += 2;
      while (i < n && profundidade > 0) {
        if (chars[i] === "/" && chars[i + 1] === "*") {
          profundidade++;
          apagar(i, i + 2);
          i += 2;
          continue;
        }
        if (chars[i] === "*" && chars[i + 1] === "/") {
          profundidade--;
          apagar(i, i + 2);
          i += 2;
          continue;
        }
        apagar(i, i + 1);
        i++;
      }
      continue;
    }
    if (c === "'") {
      apagar(i, i + 1);
      i++;
      while (i < n) {
        if (chars[i] === "'" && chars[i + 1] === "'") {
          apagar(i, i + 2);
          i += 2;
          continue;
        }
        if (chars[i] === "'") {
          apagar(i, i + 1);
          i++;
          break;
        }
        apagar(i, i + 1);
        i++;
      }
      continue;
    }
    const fechamento = dolar[dolar.length - 1];
    if (fechamento && src.startsWith(fechamento, i)) {
      dolar.pop();
      i += fechamento.length;
      continue;
    }
    if (c === ";") {
      if (dolar.length === 0) separadores.push(i);
      i++;
      continue;
    }
    const tag = tagEm(src, i);
    if (tag) {
      dolar.push(tag.raw);
      i = tag.end;
      continue;
    }
    i++;
  }
  return { visivel: chars.join(""), separadores };
}

function linhaDe(texto: string, indice: number): number {
  let linha = 1;
  for (let i = 0; i < indice && i < texto.length; i++) if (texto[i] === "\n") linha++;
  return linha;
}

function trechoDaLinha(src: string, linha: number): string {
  const texto = (src.split("\n")[linha - 1] ?? "").replace(/\s+/g, " ").trim();
  return texto.length > 180 ? `${texto.slice(0, 177)}...` : texto;
}

function temDefault(comando: string): boolean {
  return /\bDEFAULT\b/i.test(comando.replace(/\bDROP\s+DEFAULT\b/gi, " "));
}

export function encontrarViolacoes(sql: string): ViolacaoMigracao[] {
  const fonte = normalizar(sql);
  const { visivel, separadores } = preparar(sql);
  const achados: ViolacaoMigracao[] = [];
  const pontos = [...separadores, visivel.length];
  let inicio = 0;
  for (const fim of pontos) {
    const comando = visivel.slice(inicio, fim);
    for (const padrao of PADROES) {
      if (padrao.soSemDefault && temDefault(comando)) continue;
      const re = new RegExp(padrao.re.source, padrao.re.flags);
      for (const encontrado of comando.matchAll(re)) {
        const indice = inicio + (encontrado.index ?? 0);
        const linha = linhaDe(visivel, indice);
        achados.push({ regra: padrao.regra, linha, trecho: trechoDaLinha(fonte, linha) });
      }
    }
    inicio = fim + 1;
  }
  const vistos = new Set<string>();
  return achados
    .filter((v) => {
      const chave = `${v.linha}:${v.regra}:${v.trecho}`;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    })
    .sort((a, b) => a.linha - b.linha || ORDEM.indexOf(a.regra) - ORDEM.indexOf(b.regra));
}

export function selecionarMigrationsNovas(nomes: string[], existeNaBase: (caminho: string) => boolean): string[] {
  return nomes
    .map((nome) => nome.trim())
    .filter((nome) => CAMINHO_MIGRATION.test(nome) && !existeNaBase(nome));
}

export function lintarMigrations(entrada: {
  arquivos: Array<{ caminho: string; sql: string }>;
  temLabelContrato: boolean;
}): ResultadoLint {
  const violacoes = entrada.arquivos
    .flatMap((arquivo) => encontrarViolacoes(arquivo.sql).map((violacao) => ({ ...violacao, caminho: arquivo.caminho })))
    .sort((a, b) => a.caminho.localeCompare(b.caminho) || a.linha - b.linha || ORDEM.indexOf(a.regra) - ORDEM.indexOf(b.regra));
  return { ok: entrada.temLabelContrato || violacoes.length === 0, violacoes };
}

export function temLabelContrato(opcoes: { labels?: string; evento?: unknown }): boolean {
  const doAmbiente = (opcoes.labels ?? "")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
  if (doAmbiente.includes(LABEL_CONTRATO)) return true;
  const evento = opcoes.evento as { pull_request?: { labels?: Array<{ name?: string }> } } | null | undefined;
  return (evento?.pull_request?.labels ?? []).some((label) => label?.name === LABEL_CONTRATO);
}

function formatarRelatorio(resultado: ResultadoLint): string {
  if (resultado.violacoes.length === 0) return "Migrations expand-only: nenhuma violação nas migrations novas.";
  const n = resultado.violacoes.length;
  const cabeca = resultado.ok
    ? `Migrations expand-only: label ${LABEL_CONTRATO} presente; ${n === 1 ? "1 violação permitida" : `${n} violações permitidas`}.`
    : `Migrations expand-only: ${n === 1 ? "1 violação" : `${n} violações`}.`;
  const linhas = resultado.violacoes.map((v) => `${v.caminho}:${v.linha}: ${v.regra}: ${v.trecho}`);
  const rodape = resultado.ok ? "" : `\nA fase contract exige o label ${LABEL_CONTRATO}. Veja docs/migrations.md.`;
  return `${cabeca}\n${linhas.join("\n")}${rodape}`;
}

function git(args: string[], cwd: string): string {
  const resultado = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (resultado.error) throw new Error(resultado.error.message);
  if (resultado.status !== 0) throw new Error((resultado.stderr || `git ${args.join(" ")} falhou`).trim());
  return resultado.stdout;
}

function existeNaBase(cwd: string, caminho: string): boolean {
  const resultado = spawnSync("git", ["cat-file", "-e", `${REF_BASE}:${caminho}`], { cwd, encoding: "utf8" });
  return resultado.status === 0;
}

export function main(cwd = process.cwd(), env: NodeJS.ProcessEnv = process.env): number {
  let evento: unknown;
  if (env.GITHUB_EVENT_PATH && existsSync(env.GITHUB_EVENT_PATH)) {
    try {
      evento = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
    } catch {
      evento = undefined;
    }
  }
  let diff: string;
  try {
    diff = git(["-c", "core.quotepath=false", ...ARGUMENTOS_DIFF], cwd);
  } catch (erro) {
    console.error(erro instanceof Error ? erro.message : erro);
    return 2;
  }
  const arquivos = selecionarMigrationsNovas(diff.split("\n"), (caminho) => existeNaBase(cwd, caminho))
    .filter((caminho) => existsSync(resolve(cwd, caminho)))
    .map((caminho) => ({ caminho, sql: readFileSync(resolve(cwd, caminho), "utf8") }));
  const resultado = lintarMigrations({
    arquivos,
    temLabelContrato: temLabelContrato({ labels: env.PR_LABELS, evento }),
  });
  const texto = formatarRelatorio(resultado);
  if (resultado.ok) {
    console.log(texto);
    return 0;
  }
  console.error(texto);
  return 1;
}

function executadoDiretamente(): boolean {
  const entrada = process.argv[1];
  if (!entrada) return false;
  return fileURLToPath(import.meta.url) === resolve(entrada) || /lint-migrations\.ts$/.test(entrada);
}

if (process.env.LINT_MIGRATIONS_CLI === "1" || executadoDiretamente()) {
  const diretorio = process.argv[2] ? resolve(process.argv[2]) : process.cwd();
  try {
    process.exitCode = main(diretorio);
  } catch (erro) {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exitCode = 2;
  }
}
