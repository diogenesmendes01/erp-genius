// Texto como a pessoa lê — base das travas que procuram uma frase na tela (src/app/vazio-paginado.test.ts e
// o render da reserva, revisões R3 da #134 e R1 da #147). Uma frase escondida por entidade HTML, caractere
// invisível, acento decomposto, forma de largura total ou letra de outro alfabeto com a mesma cara continua
// sendo a frase que aparece na tela.

/** Latin-1 (U+00A0–U+00FF), na ordem dos códigos: a entidade i vale 0xA0 + i. */
export const ENTIDADES_LATIN1 = [
  "nbsp", "iexcl", "cent", "pound", "curren", "yen", "brvbar", "sect", "uml", "copy", "ordf", "laquo", "not", "shy", "reg", "macr",
  "deg", "plusmn", "sup2", "sup3", "acute", "micro", "para", "middot", "cedil", "sup1", "ordm", "raquo", "frac14", "frac12", "frac34", "iquest",
  "Agrave", "Aacute", "Acirc", "Atilde", "Auml", "Aring", "AElig", "Ccedil", "Egrave", "Eacute", "Ecirc", "Euml", "Igrave", "Iacute", "Icirc", "Iuml",
  "ETH", "Ntilde", "Ograve", "Oacute", "Ocirc", "Otilde", "Ouml", "times", "Oslash", "Ugrave", "Uacute", "Ucirc", "Uuml", "Yacute", "THORN", "szlig",
  "agrave", "aacute", "acirc", "atilde", "auml", "aring", "aelig", "ccedil", "egrave", "eacute", "ecirc", "euml", "igrave", "iacute", "icirc", "iuml",
  "eth", "ntilde", "ograve", "oacute", "ocirc", "otilde", "ouml", "divide", "oslash", "ugrave", "uacute", "ucirc", "uuml", "yacute", "thorn", "yuml",
] as const;
/** Grego, em faixas contínuas de código: [primeiro código, nomes]. */
export const ENTIDADES_GREGO: readonly (readonly [number, readonly string[]])[] = [
  [0x391, ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta", "Iota", "Kappa", "Lambda", "Mu", "Nu", "Xi", "Omicron", "Pi", "Rho"]],
  [0x3a3, ["Sigma", "Tau", "Upsilon", "Phi", "Chi", "Psi", "Omega"]],
  [0x3b1, ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa", "lambda", "mu", "nu", "xi", "omicron", "pi", "rho"]],
  [0x3c2, ["sigmaf", "sigma", "tau", "upsilon", "phi", "chi", "psi", "omega"]],
];
/** As demais entidades do HTML 4 que o JSX decodifica e que podem estar num texto. */
export const ENTIDADES_OUTRAS: Readonly<Record<string, number>> = {
  quot: 0x22, amp: 0x26, apos: 0x27, lt: 0x3c, gt: 0x3e,
  OElig: 0x152, oelig: 0x153, Scaron: 0x160, scaron: 0x161, Yuml: 0x178, fnof: 0x192, circ: 0x2c6, tilde: 0x2dc,
  ensp: 0x2002, emsp: 0x2003, thinsp: 0x2009, zwnj: 0x200c, zwj: 0x200d, lrm: 0x200e, rlm: 0x200f,
  ndash: 0x2013, mdash: 0x2014, lsquo: 0x2018, rsquo: 0x2019, sbquo: 0x201a, ldquo: 0x201c, rdquo: 0x201d, bdquo: 0x201e,
  dagger: 0x2020, Dagger: 0x2021, bull: 0x2022, hellip: 0x2026, permil: 0x2030, prime: 0x2032, Prime: 0x2033,
  lsaquo: 0x2039, rsaquo: 0x203a, oline: 0x203e, frasl: 0x2044, euro: 0x20ac, trade: 0x2122,
};
/** Nome da entidade (com a caixa do HTML: `Aacute` ≠ `aacute`) → código. */
export const ENTIDADES_HTML: Readonly<Record<string, number>> = Object.freeze({
  ...Object.fromEntries(ENTIDADES_LATIN1.map((nome, i) => [nome, 0xa0 + i] as const)),
  ...Object.fromEntries(ENTIDADES_GREGO.flatMap(([inicio, nomes]) => nomes.map((nome, i) => [nome, inicio + i] as const))),
  ...ENTIDADES_OUTRAS,
});

/** Entidade nomeada (da tabela) ou numérica decodificada; a desconhecida fica como está (o JSX também a deixa). */
export function decodificarEntidades(t: string): string {
  return t.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]*);/g, (m, c: string) => {
    const n = c[0] !== "#" ? ENTIDADES_HTML[c] : c[1] === "x" || c[1] === "X" ? parseInt(c.slice(2), 16) : Number(c.slice(1));
    return n !== undefined && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
  });
}

/**
 * O que não aparece na tela (largura zero): toda a classe de formatação (Cf: hífen suave, espaço de largura
 * zero, junções, marcas de direção, BOM…), o "combining grapheme joiner", os seletores de variação
 * (U+FE00–U+FE0F e U+E0100–U+E01EF) e os seletores mongóis.
 */
export const INVISIVEIS = /[\p{Cf}\u034f\u17b4\u17b5\u180b-\u180f\ufe00-\ufe0f\u{e0100}-\u{e01ef}]/gu;

/**
 * Brancos visíveis que `\s` não pega (revisão R2 da #147, B2): aparecem na tela como um espaço em branco,
 * mas a fonte pode não dar largura a eles — o texto é lido dos dois jeitos (branco como espaço e sem ele).
 * Padrão braille vazio e os preenchimentos hangul.
 */
export const BRANCOS_VISIVEIS = ["\u2800", "\u115f", "\u1160", "\u3164", "\uffa0"] as const;
const RE_BRANCOS = new RegExp(`[${BRANCOS_VISIVEIS.join("")}]`, "gu");
/** Como ler um branco visível: como espaço (a tela mostra um vão) ou como nada (a fonte não dá largura). */
export type LeituraDoBranco = "espaco" | "nada";

/** Letras de outros alfabetos com a mesma cara de uma latina (cirílico, grego e variantes latinas). */
export const HOMOGLIFOS: Readonly<Record<string, string>> = {
  "\u0430": "a", "\u0435": "e", "\u043e": "o", "\u0440": "p", "\u0441": "c", "\u0443": "y", "\u0445": "x", "\u0456": "i",
  "\u0455": "s", "\u0458": "j", "\u0501": "d", "\u04bb": "h", "\u051b": "q", "\u051d": "w", "\u04cf": "l",
  "\u0410": "A", "\u0412": "B", "\u0415": "E", "\u041a": "K", "\u041c": "M", "\u041d": "H", "\u041e": "O", "\u0420": "P",
  "\u0421": "C", "\u0422": "T", "\u0425": "X", "\u0423": "Y", "\u0406": "I", "\u0408": "J", "\u0405": "S",
  "\u03b1": "a", "\u03bf": "o", "\u03c1": "p", "\u03b9": "i", "\u03bd": "v", "\u03ba": "k", "\u03c5": "u",
  "\u0391": "A", "\u0392": "B", "\u0395": "E", "\u0396": "Z", "\u0397": "H", "\u0399": "I", "\u039a": "K", "\u039c": "M",
  "\u039d": "N", "\u039f": "O", "\u03a1": "P", "\u03a4": "T", "\u03a5": "Y", "\u03a7": "X",
  "\u0261": "g", "\u0131": "i", "\u0251": "a",
};
const RE_HOMOGLIFOS = new RegExp(`[${Object.keys(HOMOGLIFOS).join("")}]`, "gu");

/**
 * Texto lido, para mostrar (trecho de exceção e de manifesto): entidades decodificadas, acento composto (NFC),
 * sem invisíveis, todo espaço — inclusive o não separável e os brancos visíveis — como " ". Não junta espaços.
 */
export function textoLido(t: string): string {
  return decodificarEntidades(t).normalize("NFC").replace(INVISIVEIS, "").replace(RE_BRANCOS, " ").replace(/\s/g, " ");
}

/**
 * Texto lido, para comparar: além do `textoLido`, as formas de compatibilidade (NFKC: largura total,
 * ligaduras) e os homóglifos viram a letra latina; o branco visível vira espaço ou nada, conforme `branco`.
 * Não junta espaços (as posições dos pedaços se mantêm).
 */
export function textoComparavel(t: string, branco: LeituraDoBranco = "espaco"): string {
  return decodificarEntidades(t).replace(INVISIVEIS, "").replace(RE_BRANCOS, branco === "espaco" ? " " : "").normalize("NFKC")
    .replace(RE_HOMOGLIFOS, (c: string) => HOMOGLIFOS[c]).normalize("NFC").replace(/\s/g, " ");
}

/** Letra que não é latina nem comum (de outro alfabeto: cirílico, grego, armênio…). */
const LETRA_NAO_LATINA = /[^\P{L}\p{Script=Latin}\p{Script=Common}]/u;
/**
 * Palavra que mistura alfabetos (revisão R2 da #147, B1): letra latina e letra de outro alfabeto na mesma
 * palavra ("\u0578esta", com o "\u0578" armênio). Uma tabela de homóglifos sempre deixa alguma letra de fora; a
 * mistura não tem motivo num texto de tela em português. `t` já lido (NFC); devolve, por palavra misturada, a
 * posição da primeira letra de fora.
 */
export function misturaDeAlfabetos(t: string): number[] {
  const posicoes: number[] = [];
  for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) {
    const palavra = m[0];
    if (!/\p{Script=Latin}/u.test(palavra)) continue;
    const i = palavra.search(LETRA_NAO_LATINA);
    if (i >= 0) posicoes.push(m.index! + i);
  }
  return posicoes;
}
