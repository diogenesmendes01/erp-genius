import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// C46 (#170, B17 da triagem): o lint do CI tem teto de avisos, para eles não crescerem em silêncio. O teto é o
// número de avisos do `main` quando a trava entrou (40); ao resolver avisos, baixe-o no mesmo PR. Esta trava
// impede que o passo volte a `npx eslint .` sem teto, ou que o teto suba sem passar por aqui.
const TETO_DE_AVISOS = 40;
const ci = readFileSync(".github/workflows/ci.yml", "utf-8").replace(/\r\n/g, "\n");
const image = readFileSync(".github/workflows/image.yml", "utf-8").replace(/\r\n/g, "\n");

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

  it("tem concurrency configurado (group: image-${{ github.ref }})", () => {
    expect(image).toMatch(/concurrency:\s*\n\s*group:\s*image-\$\{\{\s*github\.ref\s*\}\}/);
  });

  it("concurrency cancel-in-progress true apenas para main", () => {
    expect(image).toMatch(/cancel-in-progress:\s*\$\{\{\s*github\.ref\s*==\s*['"]refs\/heads\/main['"]\s*\}\}/);
  });

  it("permissões top-level são contents: read", () => {
    expect(image).toMatch(/^permissions:\s*\n\s*contents:\s*read/m);
  });

  it("job publish tem packages: write", () => {
    // Corpo do job publish: da linha "  publish:" até o próximo job (linha "^  \w+:" sem espaços antes)
    const publishJob = image.match(/^  publish:\s*\n((?:^    .*\n)*?)(?=^  \w+:|$)/m)?.[1] ?? "";
    expect(publishJob).toContain("packages: write");
  });

  it("todas as actions são pinadas por SHA completo com comentário de versão", () => {
    const uses = [...image.matchAll(/^\s*-?\s*uses:\s*(.+)$/gm)].map((m) => m[1].trim());
    expect(uses.length).toBeGreaterThan(0);
    for (const use of uses) {
      // Deve ser: owner/repo@<sha> # vX.Y.Z
      expect(use).toMatch(/@[0-9a-f]{40}\s*#\s*v\d+\.\d+/);
    }
  });

  it("SHAs das docker actions são reais (verificados)", () => {
    const dockerActions = [
      { name: "docker/setup-buildx-action", sha: "f87e5991a6d7451dcb8d9637bfbc97413f497069", version: "v4.4.1" },
      { name: "docker/metadata-action", sha: "dc802804100637a589fabce1cb79ff13a1411302", version: "v6.2.0" },
      { name: "docker/build-push-action", sha: "c3c9e263c25d99ce0380d002d59b67737d91b0dc", version: "v7.4.0" },
      { name: "docker/login-action", sha: "dbcb813823bdd20940b903addbd779551569679f", version: "v4.6.0" },
    ];
    for (const { name, sha, version } of dockerActions) {
      const uses = [...image.matchAll(new RegExp(`${name}@([0-9a-f]{40})\\s*#\\s*(v[\\d.]+)`, "g"))];
      expect(uses.length).toBeGreaterThan(0);
      for (const match of uses) {
        expect(match[1]).toBe(sha);
        expect(match[2]).toBe(version);
      }
    }
  });

  it("publish roda DEPOIS de typecheck, lint, test e build-next", () => {
    const publishJob = image.match(/^  publish:\s*\n((?:^    .*\n)*?)(?=^  \w+:|$)/m)?.[1] ?? "";
    expect(publishJob).toContain("needs: [typecheck, lint, test, build-next]");
  });

  it("publish roda APENAS em main ou tags v*", () => {
    const publishJob = image.match(/^  publish:\s*\n((?:^    .*\n)*?)(?=^  \w+:|$)/m)?.[1] ?? "";
    expect(publishJob).toMatch(/if:.*refs\/heads\/main.*refs\/tags\/v/s);
  });

  it("job publish constrói duas imagens: app (runner) e migrate (builder)", () => {
    // Captura o job publish completo: da linha "  publish:" até o fim do arquivo (não há mais jobs depois)
    const publishJob = image.slice(image.indexOf("  publish:"));
    // Imagem do app (runner)
    expect(publishJob).toMatch(/target:\s*runner/);
    expect(publishJob).toContain("push-app");
    // Imagem do migrate (builder)
    expect(publishJob).toMatch(/target:\s*builder/);
    expect(publishJob).toContain("push-migrate");
  });

  it("job publish passa GIT_SHA como build-arg nas duas imagens", () => {
    const publishJob = image.slice(image.indexOf("  publish:"));
    const buildArgs = [...publishJob.matchAll(/build-args:\s*\|\s*\n\s*GIT_SHA=\$\{\{\s*github\.sha\s*\}\}/g)];
    expect(buildArgs.length).toBe(2); // app e migrate
  });

  it("job publish imprime digests no summary (app e migrate)", () => {
    const publishJob = image.slice(image.indexOf("  publish:"));
    expect(publishJob).toContain("GITHUB_STEP_SUMMARY");
    expect(publishJob).toContain("APP_DIGEST");
    expect(publishJob).toContain("MIGRATE_DIGEST");
  });

  it("não há job deploy (deploy é manual)", () => {
    expect(image).not.toMatch(/^  deploy:\s*$/m);
  });
});
