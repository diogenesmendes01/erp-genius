import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO } from "./mensagens";

const RAIZES = ["src/app", "src/components"];
const fontes = RAIZES.flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => ({ arquivo: join(raiz, f), conteudo: readFileSync(join(raiz, f), "utf-8") })),
);

/** Corpo de cada `catch { … }` / `catch (e) { … }`, com chaves balanceadas. */
function corposCatch(fonte: string): string[] {
  const corpos: string[] = [];
  const re = /\bcatch\s*(?:\([^)]*\))?\s*\{/g;
  for (let m = re.exec(fonte); m; m = re.exec(fonte)) {
    let nivel = 1, i = re.lastIndex;
    for (; i < fonte.length && nivel > 0; i++) {
      if (fonte[i] === "{") nivel++;
      else if (fonte[i] === "}") nivel--;
    }
    corpos.push(fonte.slice(re.lastIndex, i - 1));
  }
  return corpos;
}

/** Texto de todas as strings/template literals do trecho, concatenadas (pega "a" + "b" e quebras de linha). */
function textoDasStrings(trecho: string): string {
  return [...trecho.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)]
    .map((m) => m[1] ?? m[2] ?? m[3])
    .join(" ")
    .replace(/\s+/g, " ");
}

// Num catch o resultado é desconhecido: não pode afirmar falha, nem convidar a alterar a entrada.
const PROIBIDO = [
  /confira (?:os dados|e tente)/i,
  /\bnão foi (?:registrad|salv|gravad|enviad|efetuad|conclu)/i,
];

describe("mensagens de resultado incerto", () => {
  it("instruem repetir a MESMA entrada, nunca revisar os dados", () => {
    for (const msg of [MSG_RESULTADO_INCERTO, MSG_DECISAO_INCERTA]) {
      expect(msg).toMatch(/mesm[ao]|sem alterar/);
      expect(msg).not.toMatch(/confira os dados/i);
    }
  });

  it("o extrator acha strings quebradas, concatenadas e em template dentro de catch aninhado", () => {
    const fonte = `try { x() } catch (e) { if (a) { f("A proposta não foi " +
      "registrada."); } g(\`Confira os dados e tente novamente\`); }`;
    const texto = corposCatch(fonte).map(textoDasStrings).join(" ");
    expect(PROIBIDO.every((re) => re.test(texto))).toBe(true);
  });

  it("nenhum catch em telas/componentes afirma falha ou convida a alterar os dados", () => {
    const ofensores = fontes.flatMap(({ arquivo, conteudo }) =>
      corposCatch(conteudo)
        .map(textoDasStrings)
        .filter((texto) => PROIBIDO.some((re) => re.test(texto)))
        .map((texto) => `${arquivo}: ${texto}`),
    );
    expect(ofensores).toEqual([]);
  });
});
