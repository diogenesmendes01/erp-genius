import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Trava estática: TemplateWhatsApp guarda modelos de automação E respostas rápidas do Inbox.
// Toda listagem de templates no servidor/telas tem de dizer qual tipo quer: o filtro único da régua
// (ONDE_MODELO_REGUA) ou RESPOSTA_RAPIDA. O literal "MODELO_AUTOMACAO" só existe em modelos-regua.ts.

function arquivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return arquivos(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

/** Texto da chamada a partir de `inicio` até o parêntese que a fecha. */
function argumentos(fonte: string, inicio: number): string {
  let nivel = 0;
  for (let i = inicio; i < fonte.length; i++) {
    if (fonte[i] === "(") nivel++;
    else if (fonte[i] === ")" && --nivel === 0) return fonte.slice(inicio, i + 1);
  }
  return fonte.slice(inicio);
}

const fontes = [...arquivos("src/server"), ...arquivos("src/app")].map((p) => ({ p, s: readFileSync(p, "utf-8") }));

describe("filtro dos modelos de régua", () => {
  it("toda listagem de TemplateWhatsApp escolhe o tipo", () => {
    const sem: string[] = [];
    for (const { p, s } of fontes) {
      for (const m of s.matchAll(/templateWhatsApp\.(findMany|count)\(/g)) {
        const args = argumentos(s, m.index! + m[0].length - 1);
        if (!/ONDE_MODELO_REGUA|"RESPOSTA_RAPIDA"/.test(args)) sem.push(`${p}: ${args.slice(0, 80)}`);
      }
    }
    expect(sem).toEqual([]);
  });

  it("literal MODELO_AUTOMACAO só no helper", () => {
    const fora = fontes.filter(({ p, s }) => !p.endsWith("modelos-regua.ts") && s.includes('"MODELO_AUTOMACAO"')).map(({ p }) => p);
    expect(fora).toEqual([]);
  });
});
