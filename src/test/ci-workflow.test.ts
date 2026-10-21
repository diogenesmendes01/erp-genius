import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// C46 (#170, B17 da triagem): o lint do CI tem teto de avisos, para eles não crescerem em silêncio. O teto é o
// número de avisos do `main` quando a trava entrou (40); ao resolver avisos, baixe-o no mesmo PR. Esta trava
// impede que o passo volte a `npx eslint .` sem teto, ou que o teto suba sem passar por aqui.
const TETO_DE_AVISOS = 40;
const ci = readFileSync(".github/workflows/ci.yml", "utf-8");

describe("CI — lint com teto de avisos (C46)", () => {
  it(`o passo de lint roda o ESLint com --max-warnings ${TETO_DE_AVISOS}`, () => {
    const comandos = [...ci.matchAll(/^\s*run:\s*(npx eslint\b.*)$/gm)].map((m) => m[1].trim());
    expect(comandos).toEqual([`npx eslint . --max-warnings ${TETO_DE_AVISOS}`]);
  });

  it("nenhum outro passo roda o lint sem teto (npm run lint, eslint solto)", () => {
    expect(ci).not.toMatch(/^\s*run:\s*npm run lint\b/m);
    expect([...ci.matchAll(/\beslint\b[^\n]*/g)].map((m) => m[0]).filter((linha) => !linha.includes(`--max-warnings ${TETO_DE_AVISOS}`))).toEqual([]);
  });
});
