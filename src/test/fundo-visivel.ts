import { readFileSync } from "node:fs";
import { razao, temasDoCss, type Tema } from "@/app/contraste-nucleo";

export const DIFERENCA_MINIMA = 1.05;

const TEMAS = temasDoCss(readFileSync("src/app/globals.css", "utf-8"));
type Cores = Record<string, string | Record<string, string>>;

export function resolverToken(T: Record<string, string>, valor: string, vistos: string[] = []): string {
  const v = valor.trim().match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]+))?\)$/);
  if (!v) return valor.trim().toLowerCase();
  if (vistos.includes(v[1])) throw new Error(`var() circular: ${[...vistos, v[1]].join(" → ")}`);
  const proximo = T[v[1]] ?? v[2];
  if (proximo === undefined) throw new Error(`token ausente: ${v[1]}`);
  return resolverToken(T, proximo, [...vistos, v[1]]);
}

export function fundosDoTailwind(config: { theme?: { extend?: { colors?: unknown } } }) {
  const cores = config.theme?.extend?.colors as Cores;

  function valorDaClasse(classe: string): string {
    const nome = classe.replace(/^(?:bg|text|border)-/, "");
    const tom = nome.match(/^(.*)-(\d+)$/);
    const familia = tom ? cores[tom[1]] : undefined;
    const valor = tom && typeof familia === "object" ? familia[tom[2]] : cores[nome];
    if (typeof valor !== "string") throw new Error(`cor fora do tailwind.config: ${classe}`);
    return valor;
  }

  function destaqueSobreAPagina(classe: string, tema: Tema): number {
    const T = TEMAS[tema];
    return razao(resolverToken(T, valorDaClasse(classe)), resolverToken(T, "var(--bg-page)"));
  }

  const cor = (tema: Tema, c: string) => resolverToken(TEMAS[tema], c.startsWith("var(") ? c : valorDaClasse(c));

  return { valorDaClasse, destaqueSobreAPagina, cor };
}
