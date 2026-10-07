import { readFileSync } from "node:fs";
import ts from "typescript";

/**
 * Papéis passados ao exigirSessaoPagina(...) de uma página, para as travas "a aba tem os mesmos
 * papéis do guard" (abas de /academico e /diario). Lê a AST do TypeScript, não o texto: comentário
 * e string não contam — um `// antes: exigirSessaoPagina(Papel.X)` acima do guard real não pode
 * ser lido no lugar dele (R1 da #143, B2).
 *
 * Falha alto — em vez de devolver vazio ou uma lista parcial e deixar a trava cega — quando:
 * - o arquivo não chama o guard, ou chama mais de uma vez (qual vale?);
 * - a chamada não é `await exigirSessaoPagina(...)` (sem o await o redirect não segura a página);
 * - a chamada não tem papéis, ou algum argumento não é `Papel.X` literal (`...PAPEIS`, constante).
 * Autoteste em guard-pagina.test.ts.
 */
export function papeisDoGuardFonte(fonte: string, origem: string): string[] {
  const sf = ts.createSourceFile("pagina.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const chamadas: ts.CallExpression[] = [];
  const visitar = (no: ts.Node) => {
    if (ts.isCallExpression(no) && ts.isIdentifier(no.expression) && no.expression.text === "exigirSessaoPagina") chamadas.push(no);
    ts.forEachChild(no, visitar);
  };
  visitar(sf);

  if (chamadas.length === 0) throw new Error(`${origem}: sem exigirSessaoPagina(...)`);
  if (chamadas.length > 1) throw new Error(`${origem}: ${chamadas.length} chamadas a exigirSessaoPagina(...) — a trava exige exatamente uma`);
  const [chamada] = chamadas;
  if (!ts.isAwaitExpression(chamada.parent)) throw new Error(`${origem}: exigirSessaoPagina(...) sem await`);
  if (chamada.arguments.length === 0) throw new Error(`${origem}: exigirSessaoPagina() sem papéis — use Papel.X`);

  const papeis = chamada.arguments.map((arg) => {
    if (ts.isPropertyAccessExpression(arg) && ts.isIdentifier(arg.expression) && arg.expression.text === "Papel") return arg.name.text;
    throw new Error(`${origem}: exigirSessaoPagina com papéis não literais (${arg.getText(sf)}) — use Papel.X`);
  });
  return papeis.sort();
}

export const papeisDoGuardArquivo = (arquivo: string) => papeisDoGuardFonte(readFileSync(arquivo, "utf-8"), arquivo);
