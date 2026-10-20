import { readFileSync } from "node:fs";
import { razao, temasDoCss, type Tema } from "@/app/contraste-nucleo";

// Quanto um fundo do Tailwind (`bg-gray-100`, `bg-surface-muted`, `bg-blue-100`) se destaca do fundo da página
// (--bg-page), nos dois temas (C6, #263; revisão R1 do #269). Os tokens vêm do globals.css pelo mesmo leitor da
// trava de contraste (temasDoCss), e um token que aponta para outro (`var(--outro)`) é seguido até a cor. As cores
// do tailwind.config chegam por parâmetro (`fundosDoTailwind(config)`): fonte do src não importa de fora do src
// (trava de src/app/confirmacoes.test.ts); quem importa o config é o teste.

/**
 * Razão mínima entre um bloco e a página para ele aparecer. Não é o 3:1 de componente (WCAG 1.4.11): um
 * placeholder ou uma caixa de aviso sutil só precisam se distinguir do fundo. #ededed sobre #f7f5f3 dá ~1,08:1
 * (sutil, mas visível); um quase igual como #f7f5f4 dá ~1,00:1 e reprova.
 */
export const DIFERENCA_MINIMA = 1.05;

const TEMAS = temasDoCss(readFileSync("src/app/globals.css", "utf-8"));
type Cores = Record<string, string | Record<string, string>>;

/** Segue `var(--x)` (com ou sem fallback) até um valor que não seja var(). */
export function resolverToken(T: Record<string, string>, valor: string, vistos: string[] = []): string {
  const v = valor.trim().match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]+))?\)$/);
  if (!v) return valor.trim().toLowerCase();
  if (vistos.includes(v[1])) throw new Error(`var() circular: ${[...vistos, v[1]].join(" → ")}`);
  const proximo = T[v[1]] ?? v[2];
  if (proximo === undefined) throw new Error(`token ausente: ${v[1]}`);
  return resolverToken(T, proximo, [...vistos, v[1]]);
}

/** Leitura das classes de fundo pelo `theme.extend.colors` do tailwind.config. */
export function fundosDoTailwind(config: { theme?: { extend?: { colors?: unknown } } }) {
  const cores = config.theme?.extend?.colors as Cores;

  /** `bg-gray-100` → valor no tailwind.config (`var(--neutral-muted)`); `bg-surface-muted` → `var(--surface-muted)`. */
  function valorDaClasse(classe: string): string {
    const nome = classe.replace(/^(?:bg|text|border)-/, "");
    const tom = nome.match(/^(.*)-(\d+)$/);
    const familia = tom ? cores[tom[1]] : undefined;
    const valor = tom && typeof familia === "object" ? familia[tom[2]] : cores[nome];
    if (typeof valor !== "string") throw new Error(`cor fora do tailwind.config: ${classe}`);
    return valor;
  }

  /** Razão WCAG entre a cor da classe (composta sobre a página, se translúcida) e --bg-page no tema. */
  function destaqueSobreAPagina(classe: string, tema: Tema): number {
    const T = TEMAS[tema];
    return razao(resolverToken(T, valorDaClasse(classe)), resolverToken(T, "var(--bg-page)"));
  }

  /** Cor resolvida (hex/rgba) de uma classe (`bg-…`, `text-…`, `border-…`) ou de um `var(--x)` no tema. */
  const cor = (tema: Tema, c: string) => resolverToken(TEMAS[tema], c.startsWith("var(") ? c : valorDaClasse(c));

  return { valorDaClasse, destaqueSobreAPagina, cor };
}
