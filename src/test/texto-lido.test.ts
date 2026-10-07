import { describe, expect, it } from "vitest";
import {
  BRANCOS_VISIVEIS, ENTIDADES_GREGO, ENTIDADES_HTML, ENTIDADES_LATIN1, ENTIDADES_OUTRAS, HOMOGLIFOS, decodificarEntidades, misturaDeAlfabetos,
  textoComparavel, textoLido,
} from "./texto-lido";

// Autoteste da leitura de texto das travas (revisão R1 da #147, B1/B3/B5). As listas fechadas são
// comparadas com uma cópia literal, e o teste percorre a cópia (percorrer a própria lista não prova nada).

const COPIA_HOMOGLIFOS: Record<string, string> = {
  "\u0430": "a", "\u0435": "e", "\u043e": "o", "\u0440": "p", "\u0441": "c", "\u0443": "y", "\u0445": "x", "\u0456": "i",
  "\u0455": "s", "\u0458": "j", "\u0501": "d", "\u04bb": "h", "\u051b": "q", "\u051d": "w", "\u04cf": "l",
  "\u0410": "A", "\u0412": "B", "\u0415": "E", "\u041a": "K", "\u041c": "M", "\u041d": "H", "\u041e": "O", "\u0420": "P",
  "\u0421": "C", "\u0422": "T", "\u0425": "X", "\u0423": "Y", "\u0406": "I", "\u0408": "J", "\u0405": "S",
  "\u03b1": "a", "\u03bf": "o", "\u03c1": "p", "\u03b9": "i", "\u03bd": "v", "\u03ba": "k", "\u03c5": "u",
  "\u0391": "A", "\u0392": "B", "\u0395": "E", "\u0396": "Z", "\u0397": "H", "\u0399": "I", "\u039a": "K", "\u039c": "M",
  "\u039d": "N", "\u039f": "O", "\u03a1": "P", "\u03a4": "T", "\u03a5": "Y", "\u03a7": "X",
  "\u0261": "g", "\u0131": "i", "\u0251": "a",
  // Versaletes e letras do IPA que parecem minúsculas latinas (R3 da #147, B2).
  "\u1d00": "a", "\u1d01": "ae", "\u1d02": "ae", "\u1d03": "b", "\u1d04": "c", "\u1d05": "d", "\u1d06": "d", "\u1d07": "e",
  "\u1d08": "e", "\u1d09": "i", "\u1d0a": "j", "\u1d0b": "k", "\u1d0c": "l", "\u1d0d": "m", "\u1d0e": "n", "\u1d0f": "o",
  "\u1d10": "o", "\u1d11": "o", "\u1d12": "o", "\u1d13": "o", "\u1d14": "oe", "\u1d15": "ou", "\u1d16": "o", "\u1d17": "o",
  "\u1d18": "p", "\u1d19": "r", "\u1d1a": "r", "\u1d1b": "t", "\u1d1c": "u", "\u1d1d": "u", "\u1d1e": "u", "\u1d1f": "m",
  "\u1d20": "v", "\u1d21": "w", "\u1d22": "z", "\ua730": "f", "\ua731": "s", "\u0274": "n", "\u0280": "r", "\u028f": "y",
  "\u0262": "g", "\u029f": "l", "\u026a": "i", "\u029c": "h", "\u0299": "b",
  // O sinal de micro vira "\u03bc" grego no NFKC: lido como "u", para "\u00b5s" não misturar alfabetos.
  "\u03bc": "u",
};

const COPIA_OUTRAS: Record<string, number> = {
  quot: 0x22, amp: 0x26, apos: 0x27, lt: 0x3c, gt: 0x3e,
  OElig: 0x152, oelig: 0x153, Scaron: 0x160, scaron: 0x161, Yuml: 0x178, fnof: 0x192, circ: 0x2c6, tilde: 0x2dc,
  ensp: 0x2002, emsp: 0x2003, thinsp: 0x2009, zwnj: 0x200c, zwj: 0x200d, lrm: 0x200e, rlm: 0x200f,
  ndash: 0x2013, mdash: 0x2014, lsquo: 0x2018, rsquo: 0x2019, sbquo: 0x201a, ldquo: 0x201c, rdquo: 0x201d, bdquo: 0x201e,
  dagger: 0x2020, Dagger: 0x2021, bull: 0x2022, hellip: 0x2026, permil: 0x2030, prime: 0x2032, Prime: 0x2033,
  lsaquo: 0x2039, rsaquo: 0x203a, oline: 0x203e, frasl: 0x2044, euro: 0x20ac, trade: 0x2122,
};

/** Brancos visíveis (cópia literal): braille vazio e preenchimentos hangul (R2 da #147, B2). */
const COPIA_BRANCOS = ["\u2800", "\u115f", "\u1160", "\u3164", "\uffa0"];

/** Invisíveis que não podem separar "nes" de "ta" (cópia literal, um de cada família). */
const COPIA_INVISIVEIS = [
  "\u00ad", "\u034f", "\u061c", "\u17b4", "\u180b", "\u180e", "\u200b", "\u200c", "\u200d", "\u200e", "\u200f",
  "\u202a", "\u202e", "\u2060", "\u2064", "\u2066", "\ufe00", "\ufe0f", "\ufeff", "\u{e0001}", "\u{e0100}", "\u{e01ef}",
];

describe("texto lido (autoteste)", () => {
  it("homóglifos: a tabela é a da cópia, e cada letra vira a latina", () => {
    expect(HOMOGLIFOS).toEqual(COPIA_HOMOGLIFOS);
    for (const [outra, latina] of Object.entries(COPIA_HOMOGLIFOS)) expect(textoComparavel(outra), outra).toBe(latina);
    // O texto para mostrar guarda o que está escrito.
    expect(textoLido("p\u0430gina")).toBe("p\u0430gina");
  });

  it("entidades: tabela do HTML 4 (Latin-1, grego e as demais) com a caixa do nome", () => {
    expect(ENTIDADES_OUTRAS).toEqual(COPIA_OUTRAS);
    expect(ENTIDADES_LATIN1).toHaveLength(96);
    expect(ENTIDADES_GREGO.map(([inicio, nomes]) => [inicio, nomes.length])).toEqual([[0x391, 17], [0x3a3, 7], [0x3b1, 17], [0x3c2, 8]]);
    expect(Object.keys(ENTIDADES_HTML)).toHaveLength(96 + 17 + 7 + 17 + 8 + Object.keys(COPIA_OUTRAS).length);
    for (const [nome, codigo] of Object.entries(COPIA_OUTRAS)) expect(decodificarEntidades(`&${nome};`), nome).toBe(String.fromCodePoint(codigo));
    // Latin-1: as pontas e as letras do português (um deslocamento na lista muda todas).
    expect(decodificarEntidades("&nbsp;|&shy;|&Aacute;|&Ntilde;|&aacute;|&acirc;|&atilde;|&ccedil;|&eacute;|&ecirc;|&iacute;|&oacute;|&ocirc;|&otilde;|&uacute;|&uuml;|&yuml;"))
      .toBe("\u00a0|\u00ad|Á|Ñ|á|â|ã|ç|é|ê|í|ó|ô|õ|ú|ü|ÿ");
    expect(decodificarEntidades("&Alpha;|&Rho;|&Sigma;|&Omega;|&alpha;|&rho;|&sigmaf;|&sigma;|&omega;"))
      .toBe("\u0391|\u03a1|\u03a3|\u03a9|\u03b1|\u03c1|\u03c2|\u03c3|\u03c9");
    // Numérica decimal e hexadecimal; a desconhecida (e a caixa errada) fica como está, como no JSX.
    expect(decodificarEntidades("&#160;&#xA0;&#xa0;")).toBe("\u00a0\u00a0\u00a0");
    expect(decodificarEntidades("&naoexiste; &AACUTE; &#0;")).toBe("&naoexiste; &AACUTE; &#0;");
  });

  it("invisíveis: nenhum separa a palavra, no texto lido nem no comparável", () => {
    for (const c of COPIA_INVISIVEIS) {
      expect(textoLido(`nes${c}ta`), c.codePointAt(0)!.toString(16)).toBe("nesta");
      expect(textoComparavel(`nes${c}ta`), c.codePointAt(0)!.toString(16)).toBe("nesta");
    }
    expect(textoComparavel("nes&shy;ta nes&zwj;ta nes&zwnj;ta nes&lrm;ta nes&rlm;ta")).toBe("nesta nesta nesta nesta nesta");
  });

  it("comparável: NFKC (largura total), acento decomposto e espaços como espaço", () => {
    expect(textoComparavel("\uff4e\uff45\uff53\uff54\uff41")).toBe("nesta");
    expect(textoComparavel("pa\u0301gina")).toBe("página");
    expect(textoComparavel("nesta\u00a0página\u2003x")).toBe("nesta página x");
    expect(textoLido("pa\u0301gina")).toBe("página");
  });

  it("brancos visíveis (R2 da #147, B2): a tabela é a da cópia; lidos como espaço e, na outra leitura, como nada", () => {
    expect(BRANCOS_VISIVEIS).toEqual(COPIA_BRANCOS);
    for (const c of COPIA_BRANCOS) {
      const cod = c.codePointAt(0)!.toString(16);
      expect(textoLido(`nesta${c}página`), cod).toBe("nesta página");
      expect(textoComparavel(`nesta${c}página`), cod).toBe("nesta página");
      expect(textoComparavel(`nesta${c}página`, "espaco"), cod).toBe("nesta página");
      expect(textoComparavel(`nes${c}ta`, "nada"), cod).toBe("nesta");
    }
    // Os que `\s` já pega: separador de linha e de parágrafo, espaço matemático.
    expect(textoComparavel("nesta\u2028p\u00e1gina nesta\u2029p\u00e1gina nesta\u205fp\u00e1gina")).toBe("nesta página nesta página nesta página");
  });

  it("alfabetos misturados (R2 da #147, B1): letra de outro alfabeto numa palavra latina, dentro ou fora da tabela", () => {
    expect(misturaDeAlfabetos("\u0578esta")).toEqual([0]);
    expect(misturaDeAlfabetos("Nenhuma proposta nes\u03c4a página.")).toEqual([20]);
    expect(misturaDeAlfabetos("p\u0430gina n\u0435sta")).toEqual([1, 8]);
    // Não acusa: palavra só latina (com acento combinado), só grega, sinal de micro, número.
    expect(misturaDeAlfabetos("Página x\u0301 \u03b1\u03b2\u03b3 \u00b5s 2º 3ª")).toEqual([]);
  });

  it("R3 da #147 (B2, B3): versalete, palavra sem letra latina, símbolo como vão", () => {
    // Versalete "s" (U+A731) e "n" (U+0274): da tabela.
    expect(textoComparavel("ne\ua731ta \u0274esta")).toBe("nesta nesta");
    // Palavra sem letra latina ("\u0578\u0435\u0455\u03c4\u0430"): depois da tabela vira "\u0578es\u03c4a", que mistura alfabetos.
    const palavra = "\u0578\u0435\u0455\u03c4\u0430";
    expect(misturaDeAlfabetos(textoLido(palavra))).toEqual([]);
    expect(misturaDeAlfabetos(textoComparavel(palavra))).toEqual([0]);
    // Sinal de micro: NFKC o faz grego, a tabela o faz "u".
    expect(textoComparavel("5 \u00b5s")).toBe("5 us");
    expect(misturaDeAlfabetos(textoComparavel("5 \u00b5s"))).toEqual([]);
    // Nota nula musical (U+1D159) e outros símbolos: vão na leitura "como espaço"; ficam na leitura "nada".
    expect(textoComparavel("nesta\u{1d159}página")).toBe("nesta página");
    expect(textoComparavel("nesta\u{1d159}página", "nada")).toBe("nesta\u{1d159}página");
    expect(textoComparavel("nesta|página nesta\u2192página")).toBe("nesta página nesta página");
    // Os marcadores de uso privado das travas não viram espaço.
    expect(textoComparavel("a\ue000b\ue001c")).toBe("a\ue000b\ue001c");
  });
});
