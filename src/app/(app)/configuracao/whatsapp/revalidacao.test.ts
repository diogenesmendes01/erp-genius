import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Com uma rota por seção (E8), revalidatePath("/configuracao/whatsapp") só invalidaria o índice (que
// redireciona): as seções ficariam com dado velho depois de salvar. As ações precisam invalidar o
// layout — todas as seções abaixo dele.
describe("ações do WhatsApp revalidam as seções", () => {
  it("nenhum revalidatePath da configuração do WhatsApp sem o tipo \"layout\"", () => {
    const arquivos = (readdirSync("src/server", { recursive: true }) as string[])
      .filter((f) => /\.ts$/.test(f) && !/\.test\.ts$/.test(f))
      .map((f) => join("src/server", f));
    const chamadas = arquivos.flatMap((f) =>
      [...readFileSync(f, "utf-8").matchAll(/revalidatePath\(\s*["'`]\/configuracao\/whatsapp[^"'`]*["'`]\s*(,\s*["'`](\w+)["'`])?\s*\)/g)]
        .map((m) => ({ arquivo: f.split("\\").join("/"), tipo: m[2] ?? null })));
    expect(chamadas.length).toBeGreaterThan(0);
    expect(chamadas.filter((c) => c.tipo !== "layout")).toEqual([]);
  });
});
