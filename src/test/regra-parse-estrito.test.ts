import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap(n => { const p = path.join(dir, n); return statSync(p).isDirectory() ? arquivos(p) : [p]; });
}

describe("#530 regra de avaliação: nenhum parse estrito cru no servidor", () => {
  it("leituras usam lerConteudoRegra (exibição) ou exigirConteudoRegra (cálculo, fail-closed)", () => {
    const ofensores = arquivos(path.join(process.cwd(), "src/server"))
      .filter(f => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter(f => readFileSync(f, "utf8").includes("ConteudoRegraAvaliacaoSchema.parse("));
    expect(ofensores).toEqual([]);
  });
});
