import { readFileSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import config from "../../tailwind.config";

// Verificação no navegador do C6 (#263): no tema claro, `--surface-muted` é igual a `--bg-page` (#f7f5f3).
// Os blocos do esqueleto pintados com `bg-surface-muted` ficavam invisíveis direto na página: na primeira
// entrada no financeiro, só a moldura da tabela aparecia, sem título, abas nem indicadores. Esta trava
// resolve a cor de cada bloco pelo tailwind.config e pelo globals.css e exige que ela se distinga do
// fundo da página nos dois temas.
const m = vi.hoisted(() => ({ caminho: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => m.caminho }));

import * as Esqueletos from "./Esqueleto";
import LoadingApp from "@/app/(app)/loading";

const css = readFileSync("src/app/globals.css", "utf-8");
const variaveis = (seletor: RegExp) => {
  const bloco = css.match(seletor)?.[1] ?? "";
  return Object.fromEntries([...bloco.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((v) => [v[1], v[2].trim().toLowerCase()]));
};
const TEMAS = { claro: variaveis(/:root\s*\{([^}]*)\}/), escuro: { ...variaveis(/:root\s*\{([^}]*)\}/), ...variaveis(/\.dark\s*\{([^}]*)\}/) } };

const cores = config.theme?.extend?.colors as Record<string, string | Record<string, string>>;
/** `bg-gray-100` → `--neutral-muted`; `bg-surface-muted` → `--surface-muted`. */
function variavelDoFundo(classe: string): string {
  const nome = classe.replace(/^bg-/, "");
  const tom = nome.match(/^(.*)-(\d+)$/);
  const familia = tom ? cores[tom[1]] : undefined;
  const valor = tom && typeof familia === "object" ? familia[tom[2]] : cores[nome];
  const v = typeof valor === "string" ? valor.match(/var\((--[\w-]+)\)/)?.[1] : undefined;
  if (!v) throw new Error(`fundo sem token: ${classe}`);
  return v;
}

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
  it.each(renders)("%s: todo bloco tem fundo diferente do da página nos dois temas", (_, html) => {
    const fundos = fundosDosBlocos(html);
    expect(fundos.length).toBeGreaterThan(0);
    for (const classe of new Set(fundos)) {
      const v = variavelDoFundo(classe);
      for (const [tema, vars] of Object.entries(TEMAS)) {
        expect(vars[v], `${classe} (${v}) no tema ${tema}`).toBeTruthy();
        expect(vars[v], `${classe} (${v}) no tema ${tema} some contra --bg-page`).not.toBe(vars["--bg-page"]);
      }
    }
  });
});
