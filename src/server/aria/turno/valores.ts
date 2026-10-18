// Validador de valores: o modelo só pode citar preço, desconto e parcelas que o servidor autorizou.
// Números soltos sem marcador (horários, datas, quantidades) são ignorados.

export interface ValoresPermitidos {
  valores: number[];
  percentuais: number[];
  parcelas: number[];
}

const NUM = String.raw`(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)`;

const UNIDADES: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, três: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19,
};
const DEZENAS: Record<string, number> = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50 };
const ate19 = Object.keys(UNIDADES).sort((a, b) => b.length - a.length).join("|");
const dezenas = Object.keys(DEZENAS).join("|");
const unidades1a9 = "um|uma|dois|duas|tres|três|quatro|cinco|seis|sete|oito|nove";
const EXTENSO = String.raw`(?:(?:${dezenas})(?:\s+e\s+(?:${unidades1a9}))?|${ate19})`;

const RE_MOEDA_PREFIXO = new RegExp(String.raw`(?:US\$|R\$|₡|\$|\b(?:CRC|USD|BRL)\b)\s*${NUM}`, "giu");
const RE_MOEDA_SUFIXO = new RegExp(String.raw`(?<![\d.,])${NUM}\s*(?:reais|real|colones|colon|dólares|dolares)\b`, "giu");
const RE_PERCENT_NUM = new RegExp(String.raw`(?<![\d.,])${NUM}\s*%`, "gu");
const RE_PERCENT_EXT = new RegExp(String.raw`(?<![\p{L}])(${EXTENSO}|${NUM})\s+por\s+(?:cento|ciento)\b`, "giu");
const RE_PARCELAS = new RegExp(String.raw`(?<![\d.,\p{L}])(\d+)\s*(?:x|vezes)(?![\p{L}\d])`, "giu");

function normalizar(bruto: string): number {
  const s = bruto.trim();
  if (s.includes(".") && s.includes(",")) return Number(s.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ""));
  return Number(s.replace(",", "."));
}

function extenso(palavra: string): number | null {
  const p = palavra.toLowerCase().replace(/\s+/g, " ");
  const comp = /^(\p{L}+)\s+e\s+(\p{L}+)$/u.exec(p);
  if (comp) {
    const d = DEZENAS[comp[1]];
    const u = UNIDADES[comp[2]];
    return d != null && u != null ? d + u : null;
  }
  return DEZENAS[p] ?? UNIDADES[p] ?? null;
}

const igual = (a: number, lista: number[]) => lista.some((x) => Math.abs(x - a) < 0.005);

interface Achado {
  inicio: number;
  trecho: string;
  numero: number;
  categoria: keyof ValoresPermitidos;
}

function coletar(texto: string): Achado[] {
  const achados: Achado[] = [];
  let mascarado = texto;
  const mascarar = (i: number, len: number) => {
    mascarado = mascarado.slice(0, i) + " ".repeat(len) + mascarado.slice(i + len);
  };
  const varrer = (re: RegExp, categoria: Achado["categoria"], num: (m: RegExpExecArray) => number | null) => {
    for (const m of [...mascarado.matchAll(re)] as RegExpExecArray[]) {
      const numero = num(m);
      if (numero == null || Number.isNaN(numero)) continue;
      achados.push({ inicio: m.index, trecho: m[0].trim(), numero, categoria });
      mascarar(m.index, m[0].length);
    }
  };
  varrer(RE_MOEDA_PREFIXO, "valores", (m) => normalizar(m[1]));
  varrer(RE_MOEDA_SUFIXO, "valores", (m) => normalizar(m[1]));
  varrer(RE_PERCENT_NUM, "percentuais", (m) => normalizar(m[1]));
  varrer(RE_PERCENT_EXT, "percentuais", (m) => (/^\d/.test(m[1]) ? normalizar(m[1]) : extenso(m[1])));
  varrer(RE_PARCELAS, "parcelas", (m) => Number(m[1]));
  return achados.sort((a, b) => a.inicio - b.inicio);
}

/** Trechos monetários, percentuais ou de parcelas cujo número não está na lista permitida da categoria. */
export function valoresNaoAutorizados(texto: string, permitidos: ValoresPermitidos): string[] {
  return coletar(texto)
    .filter((a) => !igual(a.numero, permitidos[a.categoria]))
    .map((a) => a.trecho);
}
