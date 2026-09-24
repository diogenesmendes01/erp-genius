import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// E3 (docs/42-auditoria-frontend-ux.md): componente cliente que chama server action precisa tratar
// falha de transporte — senão o botão fica em "Salvando…" para sempre, ou a falha passa calada.
// O caminho padrão é useAcaoCliente/executarAcaoCliente (src/lib/acao-cliente.ts); um `catch` próprio
// também serve. O passivo herdado (54 arquivos) foi migrado nas PRs do E3 — agora a regra vale para todos.

const clientesComAction = ["src/app", "src/components"].flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.tsx$/.test(f))
    .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") }))
    .filter(({ conteudo }) => /^\s*["']use client["']/.test(conteudo))
    .filter(({ conteudo }) => importaAction(conteudo)),
);

/**
 * Importa de verdade uma server action: import de valor (não `import type`) de um módulo de
 * `@/server/` que começa com "use server". Utilitários puros de `@/server/` (schemas, formatação de
 * fuso) ficam de fora — não há chamada ao servidor a proteger.
 */
function importaAction(conteudo: string) {
  return [...conteudo.matchAll(/^import\s+(?!type\b)[^;]*from\s+["']@\/server\/([^"']+)["']/gm)].some((m) => {
    const base = join("src/server", m[1]);
    const arquivo = [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((a) => existsSync(a));
    return arquivo !== undefined && /^\s*["']use server["']/.test(readFileSync(arquivo, "utf-8"));
  });
}

/**
 * Só código: strings e comentários saem (numa passada só, para `"https://…"` não virar comentário).
 * `// } catch {` ou `"useAcaoCliente("` num texto não contam como tratamento.
 */
const soCodigo = (fonte: string) =>
  fonte.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => (m[0] === "/" ? "" : '""'));

/**
 * `try { … } catch` que protege algo assíncrono: o bloco do try tem `await` ou `.then(`. Um catch em
 * volta de `localStorage` (ou de um JSON.parse) não conta — não é ele que segura a falha da action.
 */
function temTryAssincronoComCatch(codigo: string) {
  for (const m of codigo.matchAll(/\btry\s*\{/g)) {
    let nivel = 0, i = m.index! + m[0].length - 1;
    for (; i < codigo.length; i++) {
      if (codigo[i] === "{") nivel++;
      else if (codigo[i] === "}" && --nivel === 0) break;
    }
    const bloco = codigo.slice(m.index!, i + 1);
    if (/^\s*catch\b/.test(codigo.slice(i + 1)) && /\bawait\b|\.then\(/.test(bloco)) return true;
  }
  return false;
}

/** Tratamento de verdade: try assíncrono com catch, `.catch(` numa promessa, ou a chamada dos helpers do E3. */
const trataFalha = (conteudo: string) => {
  const codigo = soCodigo(conteudo);
  return /\.catch\(|\buseAcaoCliente\(|\bexecutarAcaoCliente\(/.test(codigo) || temTryAssincronoComCatch(codigo);
};

describe("ações no cliente tratam falha de transporte", () => {
  it("todo componente cliente que chama server action trata a falha (catch ou useAcaoCliente)", () => {
    const semTratamento = clientesComAction.filter(({ conteudo }) => !trataFalha(conteudo)).map((c) => c.arquivo);
    expect(semTratamento).toEqual([]);
  });

  it("a varredura encontra os componentes (não passa vazia por erro de caminho)", () => {
    expect(clientesComAction.length).toBeGreaterThan(150);
  });
});
