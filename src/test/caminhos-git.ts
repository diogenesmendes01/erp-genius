import { execFileSync } from "node:child_process";

/** O índice, e não o disco, é a fonte: Windows pode materializar só um dos nomes. */
export function caminhosRastreados(raiz = process.cwd()): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: raiz, encoding: "utf8" }).split("\0").filter(Boolean);
}

export function colisoesDeCaminhos(caminhos: readonly string[]): string[][] {
  const grupos = new Map<string, string[]>();
  for (const caminho of caminhos) {
    const chave = caminho.toLowerCase();
    const grupo = grupos.get(chave) ?? [];
    grupo.push(caminho); grupos.set(chave, grupo);
  }
  return [...grupos.values()].filter((g) => g.length > 1).map((g) => g.sort()).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
}
