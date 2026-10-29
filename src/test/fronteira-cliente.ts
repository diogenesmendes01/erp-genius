import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const RAIZ = process.cwd();

export function arquivosCliente(dir: string): string[] {
  const abs = path.join(RAIZ, dir);
  const saida: string[] = [];
  for (const nome of readdirSync(abs)) {
    const completo = path.join(abs, nome);
    if (statSync(completo).isDirectory()) {
      saida.push(...arquivosCliente(path.relative(RAIZ, completo)));
      continue;
    }
    if (!/\.tsx?$/.test(nome) || nome.includes(".test.")) continue;
    const fonte = readFileSync(completo, "utf8");
    if (/^\s*["']use client["']/.test(fonte)) saida.push(path.relative(RAIZ, completo));
  }
  return saida;
}

/** Especificadores que sobrevivem à emissão: `import type` e nomes só-tipo somem do bundle. */
export function especificadoresDeRuntime(arquivo: string): string[] {
  const fonte = readFileSync(path.isAbsolute(arquivo) ? arquivo : path.join(RAIZ, arquivo), "utf8");
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const specs: string[] = [];
  for (const no of sf.statements) {
    if (!ts.isImportDeclaration(no) || !ts.isStringLiteral(no.moduleSpecifier)) continue;
    const clause = no.importClause;
    if (!clause) {
      specs.push(no.moduleSpecifier.text);
      continue;
    }
    if (clause.isTypeOnly) continue;
    const nomeado = clause.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements : [];
    const temValor = !!clause.name || nomeado.some((e) => !e.isTypeOnly);
    if (temValor) specs.push(no.moduleSpecifier.text);
  }
  return specs;
}

function arquivoDoModulo(spec: string): string | null {
  const rel = path.join(RAIZ, "src", spec.slice(2));
  for (const candidato of [rel + ".ts", rel + ".tsx", path.join(rel, "index.ts")]) {
    try {
      if (statSync(candidato).isFile()) return candidato;
    } catch { /* próximo candidato */ }
  }
  return null;
}

/** Módulo `@/server` cujo corpo entra no bundle do cliente (não é server action). */
export function servidorVazaParaOCliente(spec: string): boolean {
  if (!spec.startsWith("@/server/")) return false;
  const arquivo = arquivoDoModulo(spec);
  if (!arquivo) return true;
  const fonte = readFileSync(arquivo, "utf8");
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const primeiro = sf.statements[0];
  const action = !!primeiro && ts.isExpressionStatement(primeiro) && ts.isStringLiteral(primeiro.expression) && primeiro.expression.text === "use server";
  return !action;
}

export function violacoesDeCliente(arquivos: string[]): string[] {
  return arquivos.flatMap((arquivo) =>
    especificadoresDeRuntime(arquivo).flatMap((spec) => {
      const prisma = spec === "@prisma/client" || spec === "@/lib/prisma" || spec.startsWith("@/lib/prisma/");
      const servidor = servidorVazaParaOCliente(spec);
      return prisma || servidor ? [`${arquivo} → ${spec}`] : [];
    }),
  );
}
