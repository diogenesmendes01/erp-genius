import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DIFERENCA_MINIMA, fundosDoTailwind } from "@/test/fundo-visivel";
import config from "../../../../../tailwind.config";

const { destaqueSobreAPagina } = fundosDoTailwind(config);

// Revisão R1 do #269, ponto 1: no tema claro, `bg-surface-muted`/`bg-gray-50` (--surface-muted) é a mesma cor da
// página (--bg-page). As telas da Aria não têm cartão branco (os blocos são só bordas sobre a página), então um
// fundo sutil sem borda some: a pílula de estado do cabeçalho, o trilho do volume de conversas, a célula "Não faz"
// da matriz, a fala do cliente no playground e o cabeçalho da tabela do histórico. Eles passam a usar `bg-gray-100`
// (--neutral-muted). Um fundo sutil que leve borda própria (o interruptor desligado, `border-gray-400`) segue livre.
const DIR = "src/app/(app)/aria/_componentes";
const SUTIL = /\b(?:bg-surface-muted|bg-gray-50)\b/;

describe("Aria: nada de fundo igual ao da página sem borda (#269)", () => {
  it("nenhuma string de classe com bg-surface-muted/bg-gray-50 sem uma borda junto", () => {
    const ofensas: string[] = [];
    for (const arq of readdirSync(DIR).filter((f) => f.endsWith(".tsx"))) {
      const fonte = readFileSync(`${DIR}/${arq}`, "utf-8");
      // Cada literal de string ("…", '…', `…`) que tenha a classe; prefixos de estado (hover:, disabled:) ficam de fora.
      for (const m of fonte.matchAll(/"[^"\n]*"|'[^'\n]*'|`[^`]*`/g)) {
        const classes = m[0].slice(1, -1).split(/\s+/);
        if (!classes.some((c) => SUTIL.test(c) && !c.includes(":"))) continue;
        if (!classes.some((c) => /^border(?:-[a-z]+-\d+|-border-soft)?$/.test(c))) ofensas.push(`${arq}: ${m[0]}`);
      }
    }
    expect(ofensas).toEqual([]);
  });

  it("o substituto, bg-gray-100, se destaca da página nos dois temas", () => {
    for (const tema of ["claro", "escuro"] as const) expect(destaqueSobreAPagina("bg-gray-100", tema)).toBeGreaterThanOrEqual(DIFERENCA_MINIMA);
  });
});
