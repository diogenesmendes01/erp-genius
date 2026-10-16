import { readFileSync } from "node:fs";
import { TEXTO_SOBRE_SOLIDO } from "./contraste-mapa";

// A conta WCAG é a mesma de scripts/medicao-ux/nucleo.mjs, copiada aqui porque este arquivo é código de produção
// do src e as travas (colunas-ordenaveis, confirmacoes) proíbem import de fora do src. contraste.test.ts confere
// que as duas versões dão o mesmo resultado.
const hexParaRgb = (s: string): number[] => {
  const h = s.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
};
/** Cor opaca resultante; rgba() é composto sobre o fundo. */
export function corSobre(valor: string, fundo: number[]): number[] {
  const r = valor.match(/rgba?\(([^)]+)\)/);
  if (!r) return hexParaRgb(valor);
  const [R, G, B, A = 1] = r[1].split(",").map(Number);
  return [R, G, B].map((v, i) => v * A + fundo[i] * (1 - A));
}
const luminancia = (rgb: number[]): number => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Razão de contraste WCAG 2.x entre duas cores RGB. */
export function contraste(a: number[], b: number[]): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
export { hexParaRgb };

// Núcleo da trava de contraste (movido de contraste.test.ts sem mudar o comportamento), para que
// contraste.test.ts e design-system.test.ts usem a mesma conta. Ver contraste.test.ts para o contexto.

export type Tema = "claro" | "escuro";
type Rgb = number[];

export const semComentarios = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Tokens de `:root` (claro) e `.dark` (escuro, herdando o claro), lidos bloco a bloco. Falha fechada: uma
 * declaração `--x:` em qualquer outro contexto (aninhada num @media, seletor composto, `html.dark`) é erro.
 */
export function temasDoCss(css: string): Record<Tema, Record<string, string>> {
  const texto = semComentarios(css);
  const claro: Record<string, string> = {};
  const escuro: Record<string, string> = {};
  const fora: string[] = [];
  const pilha: string[] = [];
  let inicio = 0;
  const declaracao = (fim: number) => {
    const m = texto.slice(inicio, fim).trim().match(/^(--[\w-]+)\s*:\s*([\s\S]*\S)$/);
    if (!m) return;
    const contexto = pilha.join(" > ");
    if (contexto === ":root") claro[m[1]] = m[2];
    else if (contexto === ".dark") escuro[m[1]] = m[2];
    else fora.push(`${m[1]} em "${contexto || "(fora de bloco)"}"`);
  };
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === "{") {
      pilha.push(texto.slice(inicio, i).trim().replace(/\s+/g, " "));
      inicio = i + 1;
    } else if (c === "}") {
      declaracao(i);
      pilha.pop();
      inicio = i + 1;
    } else if (c === ";") {
      declaracao(i);
      inicio = i + 1;
    }
  }
  if (fora.length) throw new Error(`token declarado fora de :root/.dark: ${fora.join("; ")}`);
  return { claro, escuro: { ...claro, ...escuro } };
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+|1\.0*)\s*)?\)$/;

/** Razão WCAG de uma cor (hex ou rgb/rgba, composta sobre o fundo) sobre um fundo opaco em hex. */
export function razao(frente: string, fundo: string): number {
  if (!HEX.test(fundo)) throw new Error(`fundo não é cor opaca em hex: ${fundo}`);
  const f: Rgb = hexParaRgb(fundo);
  if (HEX.test(frente)) return contraste(hexParaRgb(frente), f);
  if (!RGB.test(frente)) throw new Error(`valor de cor não suportado: ${frente}`);
  const composta = corSobre(frente, f);
  return Math.min(contraste(composta, f), contraste(composta.map(Math.round), f));
}

export const token = (T: Record<string, string>, nome: string): string => {
  const v = T[nome];
  if (v === undefined) throw new Error(`token ausente: ${nome}`);
  return v;
};

export type Par = { tema: Tema; par: string; valor: number; minimo: number };

/**
 * Texto branco sobre cada fundo sólido (≥ 4,5), --border-control sobre cada superfície (≥ 3) e --brand-solid
 * sobre cada superfície que fica sob a seleção (≥ 3), nos dois temas.
 */
export function paresDeContraste(
  css: string,
  superficies: readonly string[],
  solidos: readonly string[],
  branco: string,
  superficiesDaSelecao: readonly string[] = [],
): Par[] {
  const temas = temasDoCss(css);
  const pares: Par[] = [];
  for (const tema of ["claro", "escuro"] as const) {
    const T = temas[tema];
    for (const s of solidos) pares.push({ tema, par: `${branco}/${s}`, valor: razao(branco, token(T, s)), minimo: 4.5 });
    for (const s of superficies) pares.push({ tema, par: `--border-control/${s}`, valor: razao(token(T, "--border-control"), token(T, s)), minimo: 3 });
    for (const s of superficiesDaSelecao) pares.push({ tema, par: `--brand-solid/${s}`, valor: razao(token(T, "--brand-solid"), token(T, s)), minimo: 3 });
  }
  return pares;
}

/**
 * Verdadeiro quando nenhuma cor opaca tem, ao mesmo tempo, ≥ 4,5:1 com o branco (luminância ≤ 1,05/4,5 − 0,05)
 * e ≥ 3:1 sobre o fundo de luminância L — mais clara (≥ 3(L + 0,05) − 0,05) ou mais escura ((L + 0,05)/3 − 0,05).
 */
export function selecaoImpossivelSobre(superficie: string): boolean {
  if (!HEX.test(superficie)) throw new Error(`fundo não é cor opaca em hex: ${superficie}`);
  // Luminância pela própria razão: contra o branco (luminância 1), razão = 1,05 / (L + 0,05).
  const L = 1.05 / contraste([255, 255, 255], hexParaRgb(superficie)) - 0.05;
  const maximoComBranco = 1.05 / 4.5 - 0.05;
  const cabeMaisClara = 3 * (L + 0.05) - 0.05 <= maximoComBranco;
  const cabeMaisEscura = (L + 0.05) / 3 - 0.05 >= 0;
  return !cabeMaisClara && !cabeMaisEscura;
}
export const reprovados = (pares: Par[]) =>
  pares.filter((p) => !(p.valor >= p.minimo)).map((p) => `${p.tema} ${p.par} ${p.valor.toFixed(3)}:1 < ${p.minimo}:1`);


/** Razão de um token de texto sobre cada fundo (tokens), nos dois temas. */
export function paresTexto(texto: string, fundos: readonly string[], minimo: number, css: string = readFileSync("src/app/globals.css", "utf-8")): Par[] {
  const temas = temasDoCss(css);
  const pares: Par[] = [];
  for (const tema of ["claro", "escuro"] as const) {
    const T = temas[tema];
    for (const f of fundos) pares.push({ tema, par: `${texto}/${f}`, valor: razao(token(T, texto), token(T, f)), minimo });
  }
  return pares;
}

/** Texto de cada sólido (TEXTO_SOBRE_SOLIDO) sobre ele, ≥ 4,5:1 nos dois temas. Devolve as reprovações. */
export function reprovadosSolidos(css: string = readFileSync("src/app/globals.css", "utf-8")): string[] {
  const temas = temasDoCss(css);
  const pares: Par[] = [];
  for (const tema of ["claro", "escuro"] as const) {
    const T = temas[tema];
    for (const [solido, texto] of Object.entries(TEXTO_SOBRE_SOLIDO)) {
      const cor = texto === "white" ? "#ffffff" : token(T, texto);
      pares.push({ tema, par: `${texto}/${solido}`, valor: razao(cor, token(T, solido)), minimo: 4.5 });
    }
  }
  return reprovados(pares);
}
