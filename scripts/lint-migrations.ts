import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const LABEL_CONTRATO = "migration-contract";

const SHA_COMPLETO = /^[0-9a-f]{40}$/i;

/** Sha de commit utilizável. `000…0` (push que cria o ref) não resolve. */
export function shaResolvivel(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const sha = valor.trim().toLowerCase();
  if (!SHA_COMPLETO.test(sha) || /^0{40}$/.test(sha)) return null;
  return sha;
}

export type BaseResolvida = { origem: "merge-base"; sha: string } | { origem: "head-primeiro-pai" };

/**
 * Sha explícito do evento. Só o `push` traz um: `before`.
 * `pull_request.base.sha` fica velho em `labeled` e `reopened`, então não é base.
 */
export function baseFixaDoEvento(nomeEvento: string | undefined, evento: unknown): string | null {
  const corpo = (evento ?? null) as { before?: unknown } | null;
  if (nomeEvento === "push") return shaResolvivel(corpo?.before);
  return null;
}

/**
 * `MIGRATION_BASE_SHA` definido, mesmo inválido, não cai no evento.
 * `pull_request` compara com `HEAD^1` do merge commit. `push` usa `before`.
 * `before` vazio ou zerado e evento que não é `pull_request` nem `push`
 * não caem em `HEAD^1`. Sem base resolvível, não há fallback para `origin/main`.
 */
export function resolverBaseFixa(
  env: { GITHUB_EVENT_NAME?: string; MIGRATION_BASE_SHA?: string },
  evento: unknown,
): BaseResolvida | null {
  if (env.MIGRATION_BASE_SHA !== undefined) {
    const sha = shaResolvivel(env.MIGRATION_BASE_SHA);
    return sha ? { origem: "merge-base", sha } : null;
  }
  if (env.GITHUB_EVENT_NAME === "pull_request") return { origem: "head-primeiro-pai" };
  if (env.GITHUB_EVENT_NAME === "push") {
    const sha = baseFixaDoEvento("push", evento);
    return sha ? { origem: "merge-base", sha } : null;
  }
  return null;
}

export function argumentosDiff(mergeBase: string): readonly string[] {
  return ["diff", "--name-only", "--no-renames", mergeBase, "--", "prisma/migrations"];
}

export type RegraMigracao =
  | "DROP TABLE"
  | "DROP SCHEMA"
  | "DROP TYPE"
  | "TRUNCATE"
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
  editadas: string[];
};

const ORDEM: RegraMigracao[] = [
  "DROP TABLE",
  "DROP SCHEMA",
  "DROP TYPE",
  "TRUNCATE",
  "DROP COLUMN",
  "RENAME",
  "ALTER COLUMN TYPE",
  "SET NOT NULL",
];

/** Objetos que `DROP` remove sem ser coluna. `COLUMN` é opcional no Postgres. */
const NAO_E_COLUNA = [
  "ACCESS",
  "AGGREGATE",
  "CAST",
  "COLLATION",
  "CONSTRAINT",
  "CONVERSION",
  "DATABASE",
  "DEFAULT",
  "DOMAIN",
  "EVENT",
  "EXPRESSION",
  "EXTENSION",
  "FOREIGN",
  "FUNCTION",
  "GROUP",
  "IDENTITY",
  "INDEX",
  "LANGUAGE",
  "MATERIALIZED",
  "NOT",
  "OPERATOR",
  "OWNED",
  "POLICY",
  "PROCEDURE",
  "PUBLICATION",
  "ROLE",
  "ROUTINE",
  "RULE",
  "SCHEMA",
  "SEQUENCE",
  "SERVER",
  "STATISTICS",
  "SUBSCRIPTION",
  "TABLE",
  "TABLESPACE",
  "TEXT",
  "TRANSFORM",
  "TRIGGER",
  "TYPE",
  "USER",
  "VIEW",
].join("|");

const IDENTIFICADOR = String.raw`(?:"[^"]+"|[A-Za-z_][\w$]*)`;

const PADROES: { regra: RegraMigracao; re: RegExp; exigeAlterTable?: boolean; ignoraCitacao?: boolean }[] = [
  { regra: "DROP TABLE", re: /\bDROP\s+TABLE\b/gi, ignoraCitacao: true },
  { regra: "DROP SCHEMA", re: /\bDROP\s+SCHEMA\b/gi, ignoraCitacao: true },
  { regra: "DROP TYPE", re: /\bDROP\s+TYPE\b/gi, ignoraCitacao: true },
  { regra: "TRUNCATE", re: /\bTRUNCATE\b/gi, ignoraCitacao: true },
  { regra: "DROP COLUMN", re: /\bDROP\s+COLUMN\b/gi, ignoraCitacao: true },
  {
    regra: "DROP COLUMN",
    exigeAlterTable: true,
    re: new RegExp(
      String.raw`\bDROP\s+(?:COLUMN\s+)?(?:IF\s+EXISTS\s+)?(?!(?:${NAO_E_COLUNA})\b)${IDENTIFICADOR}`,
      "gi",
    ),
  },
  { regra: "RENAME", re: /\bRENAME\b/gi, ignoraCitacao: true },
  {
    regra: "ALTER COLUMN TYPE",
    re: new RegExp(String.raw`\bALTER\s+COLUMN\s+${IDENTIFICADOR}\s+(?:SET\s+DATA\s+)?TYPE\b`, "gi"),
  },
  {
    regra: "ALTER COLUMN TYPE",
    re: new RegExp(String.raw`\bALTER\s+(?!COLUMN\b)${IDENTIFICADOR}\s+(?:SET\s+DATA\s+)?TYPE\b`, "gi"),
  },
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
      const preservar = literalDeExecute(chars, i);
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
        if (!preservar) apagar(i, i + 1);
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

/** Identificador entre aspas não é palavra-chave. O tamanho fica igual para a linha não andar. */
function apagarIdentificadoresCitados(sql: string): string {
  return sql.replace(/"(?:[^"]|"")*"/g, (trecho) => " ".repeat(trecho.length));
}

function normalizarIdentificador(token: string): string {
  if (token.startsWith('"') && token.endsWith('"') && token.length >= 2) {
    return token.slice(1, -1).replace(/""/g, '"');
  }
  return token.toLowerCase();
}

function procurarAcaoColuna(comando: string, acao: string): Array<{ coluna: string; indice: number }> {
  const padroes = [
    new RegExp(String.raw`\bALTER\s+COLUMN\s+(${IDENTIFICADOR})\s+${acao}\b`, "gi"),
    new RegExp(String.raw`\bALTER\s+(?!COLUMN\b)(${IDENTIFICADOR})\s+${acao}\b`, "gi"),
  ];
  const achados: Array<{ coluna: string; indice: number }> = [];
  for (const re of padroes) {
    for (const encontrado of comando.matchAll(re)) {
      const verbo = new RegExp(acao, "i").exec(encontrado[0]);
      achados.push({
        coluna: normalizarIdentificador(encontrado[1] ?? ""),
        indice: (encontrado.index ?? 0) + (verbo?.index ?? 0),
      });
    }
  }
  return achados;
}

/** `SET NOT NULL` só fica coberto por `SET DEFAULT` da mesma coluna, no mesmo comando. */
function indicesSetNotNullInseguro(comando: string): number[] {
  const comDefault = new Set(procurarAcaoColuna(comando, String.raw`SET\s+DEFAULT`).map((item) => item.coluna));
  const notNull = procurarAcaoColuna(comando, String.raw`SET\s+NOT\s+NULL`);
  const cobertos = new Set(notNull.map((item) => item.indice));
  const indices = notNull.filter((item) => !comDefault.has(item.coluna)).map((item) => item.indice);
  for (const encontrado of comando.matchAll(/\bSET\s+NOT\s+NULL\b/gi)) {
    const indice = encontrado.index ?? 0;
    if (!cobertos.has(indice)) indices.push(indice);
  }
  return indices;
}

/** `EXECUTE '...'` e `EXECUTE format('...')` executam o literal. Outro texto entre aspas não. */
function literalDeExecute(chars: string[], posAspas: number): boolean {
  let j = posAspas - 1;
  if (j >= 0 && /[eEbBxX]/.test(chars[j]) && (j === 0 || !/[A-Za-z0-9_]/.test(chars[j - 1]))) j--;
  while (j >= 0 && /\s/.test(chars[j])) j--;
  if (j >= 0 && chars[j] === "(") {
    j--;
    while (j >= 0 && /\s/.test(chars[j])) j--;
    while (j >= 0 && /[A-Za-z0-9_]/.test(chars[j])) j--;
    while (j >= 0 && /\s/.test(chars[j])) j--;
  }
  const palavra = "EXECUTE";
  const inicio = j - palavra.length + 1;
  if (inicio < 0) return false;
  if (chars.slice(inicio, j + 1).join("").toUpperCase() !== palavra) return false;
  const antes = inicio > 0 ? chars[inicio - 1] : "";
  return !/[A-Za-z0-9_]/.test(antes);
}

export function encontrarViolacoes(sql: string): ViolacaoMigracao[] {
  const fonte = normalizar(sql);
  const { visivel, separadores } = preparar(sql);
  const achados: ViolacaoMigracao[] = [];
  const pontos = [...separadores, visivel.length];
  let inicio = 0;
  for (const fim of pontos) {
    const comando = visivel.slice(inicio, fim);
    const semCitacao = apagarIdentificadoresCitados(comando);
    for (const padrao of PADROES) {
      if (padrao.exigeAlterTable && !/\bALTER\s+TABLE\b/i.test(comando)) continue;
      const alvo = padrao.ignoraCitacao ? semCitacao : comando;
      const re = new RegExp(padrao.re.source, padrao.re.flags);
      for (const encontrado of alvo.matchAll(re)) {
        const indice = inicio + (encontrado.index ?? 0);
        const linha = linhaDe(visivel, indice);
        achados.push({ regra: padrao.regra, linha, trecho: trechoDaLinha(fonte, linha) });
      }
    }
    for (const indiceLocal of indicesSetNotNullInseguro(comando)) {
      const indice = inicio + indiceLocal;
      const linha = linhaDe(visivel, indice);
      achados.push({ regra: "SET NOT NULL", linha, trecho: trechoDaLinha(fonte, linha) });
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

export function classificarMigrationsDoDiff(
  nomes: string[],
  existeNaBase: (caminho: string) => boolean,
): { novas: string[]; editadas: string[] } {
  const novas: string[] = [];
  const editadas: string[] = [];
  for (const nome of nomes.map((item) => item.trim()).filter(Boolean)) {
    if (!CAMINHO_MIGRATION.test(nome)) continue;
    if (existeNaBase(nome)) editadas.push(nome);
    else novas.push(nome);
  }
  return { novas, editadas };
}

export function selecionarMigrationsNovas(nomes: string[], existeNaBase: (caminho: string) => boolean): string[] {
  return classificarMigrationsDoDiff(nomes, existeNaBase).novas;
}

export function lintarMigrations(entrada: {
  arquivos: Array<{ caminho: string; sql: string }>;
  editadas?: string[];
  temLabelContrato: boolean;
}): ResultadoLint {
  const violacoes = entrada.arquivos
    .flatMap((arquivo) => encontrarViolacoes(arquivo.sql).map((violacao) => ({ ...violacao, caminho: arquivo.caminho })))
    .sort((a, b) => a.caminho.localeCompare(b.caminho) || a.linha - b.linha || ORDEM.indexOf(a.regra) - ORDEM.indexOf(b.regra));
  const editadas = [...new Set(entrada.editadas ?? [])].sort((a, b) => a.localeCompare(b));
  const sqlLiberado = entrada.temLabelContrato || violacoes.length === 0;
  return { ok: editadas.length === 0 && sqlLiberado, violacoes, editadas };
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

function formatarRelatorio(resultado: ResultadoLint, temLabel: boolean): string {
  const linhas = [
    ...resultado.violacoes.map((v) => `${v.caminho}:${v.linha}: ${v.regra}: ${v.trecho}`),
    ...resultado.editadas.map((caminho) => `${caminho}: edição de migration aplicada é proibida`),
  ];
  if (linhas.length === 0) return "Migrations expand-only: nenhuma violação nas migrations novas.";
  const n = linhas.length;
  if (resultado.ok) {
    const cabeca = `Migrations expand-only: label ${LABEL_CONTRATO} presente; ${n === 1 ? "1 violação permitida" : `${n} violações permitidas`}.`;
    return `${cabeca}\n${linhas.join("\n")}`;
  }
  const cabeca = `Migrations expand-only: ${n === 1 ? "1 violação" : `${n} violações`}.`;
  const notas: string[] = [];
  if (resultado.editadas.length > 0) {
    notas.push(
      `Editar ou remover uma migration já aplicada falha com ou sem o label ${LABEL_CONTRATO}. O label libera somente violações de SQL destrutivo em migration nova.`,
    );
  }
  if (!temLabel && resultado.violacoes.length > 0) {
    notas.push(`A fase contract exige o label ${LABEL_CONTRATO}. Veja docs/migrations.md.`);
  }
  return `${cabeca}\n${linhas.join("\n")}${notas.length ? `\n${notas.join("\n")}` : ""}`;
}

function git(args: string[], cwd: string): string {
  const resultado = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (resultado.error) throw new Error(resultado.error.message);
  if (resultado.status !== 0) throw new Error((resultado.stderr || `git ${args.join(" ")} falhou`).trim());
  return resultado.stdout;
}

function existeNoCommit(cwd: string, commit: string, caminho: string): boolean {
  const resultado = spawnSync("git", ["cat-file", "-e", `${commit}:${caminho}`], { cwd, encoding: "utf8" });
  return resultado.status === 0;
}

function lerEvento(env: NodeJS.ProcessEnv): unknown {
  if (!env.GITHUB_EVENT_PATH || !existsSync(env.GITHUB_EVENT_PATH)) return undefined;
  try {
    return JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
  } catch {
    return undefined;
  }
}

export function main(cwd = process.cwd(), env: NodeJS.ProcessEnv = process.env): number {
  const evento = lerEvento(env);
  const base = resolverBaseFixa(
    { GITHUB_EVENT_NAME: env.GITHUB_EVENT_NAME, MIGRATION_BASE_SHA: env.MIGRATION_BASE_SHA },
    evento,
  );
  if (!base) {
    console.error(
      "Migrations expand-only: base do evento não resolvida. pull_request usa HEAD^1 do merge commit, push usa before. before vazio ou zerado e evento que não é pull_request nem push não caem em HEAD^1. Sem base resolvível o lint falha.",
    );
    return 2;
  }
  if (base.origem === "head-primeiro-pai") {
    const segundoPai = spawnSync("git", ["rev-parse", "--verify", "--quiet", "HEAD^2"], { cwd, encoding: "utf8" });
    if (segundoPai.status !== 0) {
      console.error(
        "Migrations expand-only: no pull_request o HEAD precisa ser merge commit (HEAD^2). Sem o segundo pai o lint falha fechado e não compara com HEAD^1.",
      );
      return 2;
    }
  }
  let mergeBase: string;
  try {
    const saida =
      base.origem === "head-primeiro-pai"
        ? git(["rev-parse", "--verify", "HEAD^1"], cwd).trim()
        : git(["merge-base", "HEAD", base.sha], cwd).trim();
    const sha = shaResolvivel(saida);
    if (!sha) throw new Error(base.origem === "head-primeiro-pai" ? "HEAD^1 não é um commit." : "merge-base não devolveu um sha.");
    mergeBase = sha;
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro);
    const contexto = base.origem === "head-primeiro-pai" ? "HEAD^1 do merge commit" : "merge-base com a base do evento";
    console.error(`Migrations expand-only: ${contexto} não resolveu.\n${detalhe}`);
    return 2;
  }
  let diff: string;
  try {
    diff = git(["-c", "core.quotepath=false", ...argumentosDiff(mergeBase)], cwd);
  } catch (erro) {
    console.error(erro instanceof Error ? erro.message : erro);
    return 2;
  }
  const classificacao = classificarMigrationsDoDiff(diff.split("\n"), (caminho) =>
    existeNoCommit(cwd, mergeBase, caminho),
  );
  // No push o evento não traz labels. Migration nova já passou no pull_request;
  // reler o SQL aqui deixaria a contract vermelha na main. Edição de migration
  // já aplicada continua valendo, porque o push direto ainda precisa ser barrado.
  const arquivos =
    env.GITHUB_EVENT_NAME === "push"
      ? []
      : classificacao.novas
          .filter((caminho) => existsSync(resolve(cwd, caminho)))
          .map((caminho) => ({ caminho, sql: readFileSync(resolve(cwd, caminho), "utf8") }));
  const temLabel = temLabelContrato({ labels: env.PR_LABELS, evento });
  const resultado = lintarMigrations({
    arquivos,
    editadas: classificacao.editadas,
    temLabelContrato: temLabel,
  });
  const texto = formatarRelatorio(resultado, temLabel);
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
