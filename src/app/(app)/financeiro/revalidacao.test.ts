import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Com uma rota por aba (E8), revalidatePath("/financeiro") só invalidaria o índice (que redireciona):
// as abas mostrariam dado velho depois de uma ação. As ações invalidam o layout — todas as rotas abaixo.
describe("ações revalidam as abas do /financeiro", () => {
  it("nenhum revalidatePath(\"/financeiro\") sem o tipo \"layout\"", () => {
    const chamadas = (readdirSync("src/server", { recursive: true }) as string[])
      .filter((f) => /\.ts$/.test(f) && !/\.test\.ts$/.test(f))
      .flatMap((f) => [...readFileSync(join("src/server", f), "utf-8").matchAll(/revalidatePath\(\s*["'`]\/financeiro["'`]\s*(,\s*["'`](\w+)["'`])?\s*\)/g)]
        .map((m) => ({ arquivo: f.split("\\").join("/"), tipo: m[2] ?? null })));
    expect(chamadas.length).toBeGreaterThan(0);
    expect(chamadas.filter((c) => c.tipo !== "layout")).toEqual([]);
  });
});
