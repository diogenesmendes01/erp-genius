import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { caminhosRastreados, colisoesDeCaminhos } from "@/test/caminhos-git";

describe("portabilidade dos caminhos rastreados", () => {
  it("não permite colisões case-insensitive no índice real do projeto", () => {
    expect(colisoesDeCaminhos(caminhosRastreados())).toEqual([]);
  });

  it("detecta os dois nomes no índice Git mesmo sem materializar arquivos no Windows", () => {
    const baseTemporaria = realpathSync(tmpdir());
    const raiz = mkdtempSync(join(baseTemporaria, "erp-caminhos-"));
    const git = (...args: string[]) => execFileSync("git", args, { cwd: raiz, encoding: "utf8" });
    try {
      git("init", "--quiet"); git("config", "core.ignorecase", "false");
      const blob = execFileSync("git", ["hash-object", "-w", "--stdin"], { cwd: raiz, input: "", encoding: "utf8" }).trim();
      for (const caminho of ["src/Caixa.tsx", "src/caixa.tsx", "docs/rota.md"]) {
        git("update-index", "--add", "--cacheinfo", "100644," + blob + "," + caminho);
      }
      expect(colisoesDeCaminhos(caminhosRastreados(raiz))).toEqual([["src/Caixa.tsx", "src/caixa.tsx"]]);
    } finally {
      if (dirname(realpathSync(raiz)) !== baseTemporaria) throw new Error("Diretório temporário fora da base conferida.");
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it("aceita nomes distintos e encontra diferenças de caixa também nos diretórios", () => {
    expect(colisoesDeCaminhos(["src/Lista.tsx", "src/Listas.tsx", "docs/lista.md"])).toEqual([]);
    expect(colisoesDeCaminhos(["src/Inbox/a.ts", "src/inbox/A.ts"])).toEqual([["src/Inbox/a.ts", "src/inbox/A.ts"]]);
  });

  it("entrega LF no checkout para fontes TypeScript lidas pelas guardas", () => {
    const saida = execFileSync("git", ["check-attr", "-z", "eol", "--", "src/app/paleta.test.ts", "src/components/Avatar.tsx", "scripts/visual/capturar-inbox.mjs", ".github/workflows/ci.yml"], { encoding: "utf8" }).split("\0").filter(Boolean);
    expect(saida).toEqual([
      "src/app/paleta.test.ts", "eol", "lf",
      "src/components/Avatar.tsx", "eol", "lf",
      "scripts/visual/capturar-inbox.mjs", "eol", "lf",
      ".github/workflows/ci.yml", "eol", "lf",
    ]);
  });
});
