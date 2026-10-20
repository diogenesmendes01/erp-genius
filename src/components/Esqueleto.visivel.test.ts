import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Verificação no navegador do C6 (#263): no tema claro, `--surface-muted` é igual a `--bg-page` (#f7f5f3).
// Os blocos do esqueleto pintados com `bg-surface-muted` ficavam invisíveis direto na página: na primeira
// entrada no financeiro, só a moldura da tabela aparecia, sem título, abas nem indicadores. Esta trava
// resolve a cor de cada bloco pelo tailwind.config e pelo globals.css (seguindo `var()` encadeado) e exige
// uma razão mínima de contraste contra o fundo da página nos dois temas, não só um valor diferente (revisão
// R1 do #269: #f7f5f4 seria "diferente" de #f7f5f3 e continuaria invisível).
const m = vi.hoisted(() => ({ caminho: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => m.caminho }));

import * as Esqueletos from "./Esqueleto";
import LoadingApp from "@/app/(app)/loading";
import { razao } from "@/app/contraste-nucleo";
import { DIFERENCA_MINIMA, fundosDoTailwind, resolverToken } from "@/test/fundo-visivel";
import config from "../../tailwind.config";

const { destaqueSobreAPagina } = fundosDoTailwind(config);

/** Fundos dos blocos (divs sem filhos) do HTML de um esqueleto. */
const fundosDosBlocos = (html: string) =>
  [...html.matchAll(/<div class="([^"]*)"[^>]*><\/div>/g)].flatMap((b) => b[1].split(" ").filter((c) => /^bg-/.test(c)));

const renders: [string, string][] = [
  ...Object.entries(Esqueletos)
    .filter(([nome]) => nome.startsWith("Esqueleto"))
    .map(([nome, C]) => [nome, renderToStaticMarkup(createElement(C as (p: { rotulo: string }) => ReactNode, { rotulo: "x" }))] as [string, string]),
  ...["/home", "/financeiro", "/configuracao", "/matriculas/m1", "/academico", "/diario"].map((c): [string, string] => {
    m.caminho = c;
    return [`(app)/loading ${c}`, renderToStaticMarkup(createElement(LoadingApp))];
  }),
];

describe("esqueleto visível sobre a página (C6, #263)", () => {
  it.each(renders)("%s: todo bloco se destaca do fundo da página nos dois temas", (_, html) => {
    const fundos = fundosDosBlocos(html);
    expect(fundos.length).toBeGreaterThan(0);
    for (const classe of new Set(fundos)) {
      for (const tema of ["claro", "escuro"] as const) {
        expect(destaqueSobreAPagina(classe, tema), `${classe} no tema ${tema} some contra --bg-page`).toBeGreaterThanOrEqual(DIFERENCA_MINIMA);
      }
    }
  });
});

describe("a conta da trava (fundo-visivel)", () => {
  it("segue var() encadeado até a cor e recusa var() circular", () => {
    expect(resolverToken({ "--a": "var(--b)", "--b": "var( --c )", "--c": "#F7F5F4" }, "var(--a)")).toBe("#f7f5f4");
    expect(resolverToken({}, "var(--ausente, #ededed)")).toBe("#ededed");
    expect(() => resolverToken({ "--a": "var(--b)", "--b": "var(--a)" }, "var(--a)")).toThrow(/circular/);
  });

  it("um tom quase igual ao da página reprova; o cinza do esqueleto passa; surface-muted no claro (o bug do C6) reprova", () => {
    expect(razao("#f7f5f4", "#f7f5f3")).toBeLessThan(DIFERENCA_MINIMA);
    expect(razao("#ededed", "#f7f5f3")).toBeGreaterThanOrEqual(DIFERENCA_MINIMA);
    expect(destaqueSobreAPagina("bg-surface-muted", "claro")).toBeLessThan(DIFERENCA_MINIMA);
  });
});
