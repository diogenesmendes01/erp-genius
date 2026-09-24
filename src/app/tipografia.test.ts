import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// docs/18: só 400 e 500 são pesos reais; qualquer peso maior vira negrito sintético do navegador.
const PESOS_REAIS = ["400", "500"];

const fontes = (readdirSync("src", { recursive: true }) as string[])
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
  .map((f) => ({ arquivo: join("src", f), conteudo: readFileSync(join("src", f), "utf-8") }));
const folhasCss = (readdirSync("src", { recursive: true }) as string[])
  .filter((f) => f.endsWith(".css"))
  .map((f) => ({ arquivo: join("src", f), conteudo: readFileSync(join("src", f), "utf-8") }));

describe("tipografia — só os pesos carregados", () => {
  it("layout.tsx registra exatamente os pesos 400 e 500", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf-8");
    const pesos = [...layout.matchAll(/weight:\s*"(\d+)"/g)].map((m) => m[1]).sort();
    expect(pesos).toEqual(PESOS_REAIS);
  });

  it("src/app/fonts só contém os arquivos desses pesos", () => {
    expect(readdirSync("src/app/fonts").sort()).toEqual(["AnthropicSans-Text-Medium.otf", "AnthropicSans-Text-Regular.otf"]);
  });

  it("nenhum componente pede peso acima de 500 (classe Tailwind, style inline ou CSS)", () => {
    const pesado = /\bfont-(?:semibold|bold|extrabold|black)\b|\bfont-\[[6-9]\d\d\]|fontWeight:\s*["']?(?:bold|[6-9]\d\d)\b|font-weight:\s*(?:bold|bolder|[6-9]\d\d)\b/;
    const ofensores = [...fontes, ...folhasCss].flatMap(({ arquivo, conteudo }) =>
      conteudo.split("\n").flatMap((linha, i) => (pesado.test(linha) ? [`${arquivo}:${i + 1}`] : [])),
    );
    expect(ofensores).toEqual([]);
  });

  it("elementos em negrito por padrão (h1–h6, dt, b, strong, th) são levados a 500 no CSS base", () => {
    const css = readFileSync("src/app/globals.css", "utf-8");
    const regra = css.match(/((?:\b(?:h[1-6]|dt|b|strong|th)\s*,\s*)*\b(?:h[1-6]|dt|b|strong|th))\s*\{\s*font-weight:\s*500;?\s*\}/);
    expect(regra).not.toBeNull();
    const seletores = regra![1].split(",").map((s) => s.trim()).sort();
    expect(seletores).toEqual(["b", "dt", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "th"]);
  });
});
