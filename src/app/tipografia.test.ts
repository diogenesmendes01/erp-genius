import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// docs/18: Roboto variável (100–900); a UI usa só os pesos 400, 500 e 600.
const HASH_ROBOTO = "9b7e4c048bb083f9702640b8e25580f04dd7292331104c1ac5ba208d6ba8c36d";

const fontes = (readdirSync("src", { recursive: true }) as string[])
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
  .map((f) => ({ arquivo: join("src", f), conteudo: readFileSync(join("src", f), "utf-8") }));
const folhasCss = (readdirSync("src", { recursive: true }) as string[])
  .filter((f) => f.endsWith(".css"))
  .map((f) => ({ arquivo: join("src", f), conteudo: readFileSync(join("src", f), "utf-8") }));

describe("tipografia — Roboto variável, pesos 400/500/600", () => {
  it("layout registra Roboto variável 100–900", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf-8");
    expect(layout).toMatch(/roboto-variable\.woff2/);
    expect(layout).toMatch(/weight:\s*"100 900"/);
  });

  it("src/app/fonts só tem a Roboto e a licença", () => {
    expect(readdirSync("src/app/fonts").sort()).toEqual(["LICENSE-Roboto.txt", "roboto-variable.woff2"]);
  });

  it("hash da fonte confere", () => {
    const hash = createHash("sha256").update(readFileSync("src/app/fonts/roboto-variable.woff2")).digest("hex");
    expect(hash).toBe(HASH_ROBOTO);
  });

  it("nenhum componente pede peso acima de 600 (classe Tailwind, style inline ou CSS)", () => {
    const pesado = /\bfont-(?:bold|extrabold|black)\b|\bfont-\[(?:[7-9]\d\d)\]|fontWeight:\s*["']?(?:bold|[7-9]\d\d)\b|font-weight:\s*(?:bold|bolder|[7-9]\d\d)\b/;
    const ofensores = [...fontes, ...folhasCss].flatMap(({ arquivo, conteudo }) =>
      conteudo.split("\n").flatMap((linha, i) => (pesado.test(linha) ? [`${arquivo}:${i + 1}`] : [])),
    );
    expect(ofensores).toEqual([]);
  });

  it("elementos em negrito por padrão (h1–h6, dt, b, strong, th) são levados a 600 no CSS base", () => {
    const css = readFileSync("src/app/globals.css", "utf-8");
    const regra = css.match(/((?:\b(?:h[1-6]|dt|b|strong|th)\s*,\s*)*\b(?:h[1-6]|dt|b|strong|th))\s*\{\s*font-weight:\s*600;?\s*\}/);
    expect(regra).not.toBeNull();
    const seletores = regra![1].split(",").map((s) => s.trim()).sort();
    expect(seletores).toEqual(["b", "dt", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "th"]);
  });
});
