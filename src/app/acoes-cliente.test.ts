import { readdirSync, readFileSync } from "node:fs";
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
    .filter(({ conteudo }) => /^import\s+(?!type\b)[^;]*from\s+["']@\/server\//m.test(conteudo)),
);

/**
 * Só código: strings e comentários saem (numa passada só, para `"https://…"` não virar comentário).
 * `// } catch {` ou `"useAcaoCliente("` num texto não contam como tratamento.
 */
const soCodigo = (fonte: string) =>
  fonte.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => (m[0] === "/" ? "" : '""'));

/** Sintaxe de verdade: `} catch {`, `} catch (e) {`, `.catch(` — ou a chamada dos helpers do E3. */
const trataFalha = (conteudo: string) =>
  /\}\s*catch\s*[({]|\.catch\(|\buseAcaoCliente\(|\bexecutarAcaoCliente\(/.test(soCodigo(conteudo));

describe("ações no cliente tratam falha de transporte", () => {
  it("todo componente cliente que chama server action trata a falha (catch ou useAcaoCliente)", () => {
    const semTratamento = clientesComAction.filter(({ conteudo }) => !trataFalha(conteudo)).map((c) => c.arquivo);
    expect(semTratamento).toEqual([]);
  });

  it("a varredura encontra os componentes (não passa vazia por erro de caminho)", () => {
    expect(clientesComAction.length).toBeGreaterThan(150);
  });
});
