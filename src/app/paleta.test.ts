import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import config from "../../tailwind.config";

// docs/18: só as shades mapeadas no tailwind.config.ts invertem no dark. O config usa `extend`,
// então a paleta padrão do Tailwind continua compilando — e cor fora do mapa quebra o tema escuro.

const cores = (config.theme?.extend?.colors ?? {}) as Record<string, string | Record<string, string>>;
const MAPA = new Map(
  Object.entries(cores)
    .filter(([, v]) => typeof v === "object")
    .map(([nome, shades]) => [nome, new Set(Object.keys(shades as object).map(Number))]),
);
const PADRAO_TAILWIND = new Set(
  "slate gray zinc neutral stone red orange amber yellow lime green emerald teal cyan sky blue indigo violet purple fuchsia pink rose".split(" "),
);

const UTILITARIO_COR =
  /(?<![\w-])(?:[a-z0-9-]+:)*!?(?:bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|divide|from|via|to|fill|stroke|placeholder|accent|caret|decoration)-([a-z]+)-(\d{2,3})(?:\/\d+)?(?![\w-])/g;
// Sombra/elevação como classe (docs/18: sem sombras): shadow-*, drop-shadow-* e valores arbitrários shadow-[…].
// Precedida de início/espaço/aspas e seguida de espaço/aspas — não pega o texto "ensaio (shadow)".
const UTILITARIO_SOMBRA = /(?:^|[\s"'`])((?:[a-z0-9-]+:)*(?:drop-)?shadow(?:-(?:sm|md|lg|xl|2xl|inner)|-\[[^\]\s]+\])?)(?=[\s"'`]|$)/g;
// Cor solta em valor arbitrário: hex, rgb()/rgba(), hsl()/hsla(). Nomes de cor CSS (bg-[red]) não entram.
const COR_ARBITRARIA = /(?<![\w-])(?:[a-z0-9-]+:)*[a-z-]+-\[(?:#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?)\([^\]]*\))\]/g;

function violacoesDePaleta(texto: string): string[] {
  const achados: string[] = [];
  for (const m of texto.matchAll(UTILITARIO_COR)) {
    const [classe, cor, shade] = m;
    const permitidas = MAPA.get(cor);
    if (permitidas ? !permitidas.has(Number(shade)) : PADRAO_TAILWIND.has(cor)) achados.push(classe);
  }
  for (const m of texto.matchAll(UTILITARIO_SOMBRA)) achados.push(m[1]);
  for (const m of texto.matchAll(COR_ARBITRARIA)) achados.push(m[0]);
  return achados;
}

// Onde vivem classes de UI. src/server fica de fora: lá "shadow" é o modo de ensaio do WhatsApp.
const RAIZES_UI = ["src/app", "src/components", "src/lib"];
const fontes = RAIZES_UI.flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.(tsx?|css)$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => ({ arquivo: join(raiz, f), linhas: readFileSync(join(raiz, f), "utf-8").split("\n") })),
);

describe("paleta do design system", () => {
  it("o detector pega cor fora do mapa, shade não mapeada, variantes, sombra e hex; e aceita o mapeado", () => {
    expect(violacoesDePaleta(`"bg-rose-500 dark:text-emerald-700 hover:border-gray-950 md:dark:ring-sky-300 !text-slate-400 text-brand-900 border-t-red-300"`))
      .toEqual(["bg-rose-500", "dark:text-emerald-700", "hover:border-gray-950", "md:dark:ring-sky-300", "!text-slate-400", "text-brand-900", "border-t-red-300"]);
    expect(violacoesDePaleta(`"rounded shadow-md focus:shadow drop-shadow-lg shadow-[0_4px_8px_#0003]" "bg-[#fff]"`))
      .toEqual(["shadow-md", "focus:shadow", "drop-shadow-lg", "shadow-[0_4px_8px_#0003]", "bg-[#fff]"]);
    expect(violacoesDePaleta(`"bg-[rgb(0,0,0)] dark:text-[hsla(0,0%,100%,.8)]"`)).toEqual(["bg-[rgb(0,0,0)]", "dark:text-[hsla(0,0%,100%,.8)]"]);
    expect(violacoesDePaleta(`"text-red-500 bg-gray-100/50 border-ai-200 bg-brand-solid bg-surface -mt-2 shadow-none drop-shadow-none w-[640px]"`)).toEqual([]);
    expect(violacoesDePaleta(`<option value="SHADOW">Ensaio (shadow) — não envia</option> "desligada/shadow/ativa"`)).toEqual([]);
  });

  it("nenhum arquivo usa cor fora do mapa, shade não mapeada, sombra ou hex solto", () => {
    const ofensores = fontes.flatMap(({ arquivo, linhas }) =>
      linhas.flatMap((linha, i) => violacoesDePaleta(linha).map((classe) => `${arquivo}:${i + 1} ${classe}`)),
    );
    expect(ofensores).toEqual([]);
  });
});
