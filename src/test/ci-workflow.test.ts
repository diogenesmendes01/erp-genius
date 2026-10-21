import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// C46 (#170, B17 da triagem): o lint do CI tem teto de avisos, para eles não crescerem em silêncio. O teto é o
// número de avisos do `main` quando a trava entrou (40); ao resolver avisos, baixe-o no mesmo PR. Esta trava
// impede que o passo volte a `npx eslint .` sem teto, ou que o teto suba sem passar por aqui.
const TETO_DE_AVISOS = 40;
const ci = readFileSync(".github/workflows/ci.yml", "utf-8");
const image = readFileSync(".github/workflows/image.yml", "utf-8");

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

describe("Workflow de imagem — build e publicação no GHCR", () => {
  it("existe o arquivo .github/workflows/image.yml", () => {
    expect(image.length).toBeGreaterThan(0);
  });

  it("roda em push na main e em tags v*", () => {
    expect(image).toMatch(/on:\s*\n\s*push:\s*\n\s*branches:\s*\[main\]/s);
    expect(image).toMatch(/tags:\s*\['v\*'\]/);
  });

  it("tem concurrency configurado", () => {
    expect(image).toMatch(/concurrency:/);
    expect(image).toMatch(/group:/);
  });

  it("permissões top-level são contents: read", () => {
    expect(image).toMatch(/^permissions:\s*\n\s*contents:\s*read/m);
  });

  it("job publish tem packages: write", () => {
    const publishJob = image.match(/publish:\s*\n([\s\S]*?)(?=\n\w+:|$)/)?.[1] ?? "";
    expect(publishJob).toContain("packages: write");
  });

  it("todas as actions são pinadas por SHA completo com comentário de versão", () => {
    const uses = [...image.matchAll(/^\s*-?\s*uses:\s*(.+)$/gm)].map((m) => m[1].trim());
    expect(uses.length).toBeGreaterThan(0);
    for (const use of uses) {
      // Deve ser: owner/repo@<sha> # vX.Y.Z
      expect(use).toMatch(/@[0-9a-f]{40}\s*#\s*v\d+/);
    }
  });

  it("build roda DEPOIS de typecheck, lint, test e build-next", () => {
    const buildJob = image.match(/build:\s*\n([\s\S]*?)(?=\n\w+:|$)/)?.[1] ?? "";
    expect(buildJob).toContain("needs: [typecheck, lint, test, build-next]");
  });

  it("publish roda APENAS em main ou tags v*", () => {
    const publishJob = image.match(/publish:\s*\n([\s\S]*?)(?=\n\w+:|$)/)?.[1] ?? "";
    expect(publishJob).toContain("if:");
    expect(publishJob).toMatch(/refs\/heads\/main.*refs\/tags\/v/s);
  });

  it("job publish imprime digest no summary", () => {
    const publishJob = image.match(/publish:\s*\n([\s\S]*?)(?=\n\w+:|$)/)?.[1] ?? "";
    expect(publishJob).toContain("GITHUB_STEP_SUMMARY");
    expect(publishJob).toContain("digest");
  });
});
