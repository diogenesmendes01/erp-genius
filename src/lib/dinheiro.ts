export interface ValorMoeda {
  moeda: string;
  valor: number;
}

const SIMBOLO_MOEDA: Record<string, string> = {
  USD: "US$",
  CRC: "₡",
  BRL: "R$",
  MXN: "MX$",
  GTQ: "Q",
  HNL: "L",
  NIO: "C$",
  PAB: "B/.",
  DOP: "RD$",
  COP: "COL$",
  PEN: "S/",
  ARS: "AR$",
  CLP: "CLP$",
  UYU: "$U",
  BOB: "Bs",
  PYG: "₲",
  VES: "Bs",
  EUR: "€",
};

const SEM_DECIMAIS = new Set(["CRC", "CLP", "PYG", "COP", "ISK", "JPY"]);

function normalizar(moeda: string): string {
  return (moeda ?? "").trim().toUpperCase();
}

export function simboloMoeda(moeda: string): string {
  const m = normalizar(moeda);
  return SIMBOLO_MOEDA[m] ?? m;
}

export function casasDecimais(moeda: string): number {
  return SEM_DECIMAIS.has(normalizar(moeda)) ? 0 : 2;
}

export function formatarMoeda(valor: number | string, moeda: string, opts?: { semSimbolo?: boolean }): string {
  const m = normalizar(moeda);
  const n = typeof valor === "number" ? valor : typeof valor === "string" && valor.trim() !== "" ? Number(valor) : NaN;
  if (!Number.isFinite(n)) {
    if (process.env.NODE_ENV === "development") console.warn(`formatarMoeda: valor inválido ${JSON.stringify(valor)} (${m || "sem moeda"})`);
    return "—";
  }
  const casas = SEM_DECIMAIS.has(m) && Number.isInteger(n) ? 0 : 2;
  const numero = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(n);
  if (opts?.semSimbolo) return numero;
  const simbolo = SIMBOLO_MOEDA[m] ?? m;
  return simbolo ? `${simbolo} ${numero}` : numero;
}

function ordemMoeda(moeda: string): number {
  return moeda === "USD" ? 0 : 1;
}

export function parseMoeda(texto: string): number | null {
  const limpo = texto.trim();
  if (/^\d+(?:,\d{1,2})?$/.test(limpo)) return Number(limpo.replace(",", "."));
  const comPonto = /^(\d+)\.\d{1,2}$/.exec(limpo);
  if (!comPonto) return null;
  const inteiro = comPonto[1];
  if (inteiro.length <= 3 && !inteiro.startsWith("0")) return null;
  return Number(limpo);
}

export function formatarMoedaParaCampo(valor: number, moeda?: string): string {
  const casas = moeda && casasDecimais(moeda) === 0 && Number.isInteger(valor) ? 0 : 2;
  return valor.toFixed(casas).replace(".", ",");
}

export function avisoSemCentavos(texto: string, moeda?: string | null): string | null {
  if (!moeda || casasDecimais(moeda) !== 0) return null;
  const numero = parseMoeda(texto);
  if (numero === null || Number.isInteger(numero)) return null;
  return `${normalizar(moeda)} normalmente não usa centavos — confira o valor. Ele será registrado exatamente como digitado, sem arredondamento.`;
}

export const DICA_PONTO_DECIMAL = "Use vírgula para os centavos (ex.: 100,50).";
export const DICA_PONTO_MILHAR = "Não use ponto de milhar: digite o valor sem separador (ex.: 1234,56).";

export function avisoPontoAmbiguo(texto: string): string | null {
  const limpo = texto.trim();
  if (!limpo.includes(".") || parseMoeda(limpo) !== null) return null;
  if (/^\d{1,3}\.\d{1,2}$/.test(limpo)) return DICA_PONTO_DECIMAL;
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(limpo)) return DICA_PONTO_MILHAR;
  return null;
}

export const MOEDA_NAO_DEFINIDA = "moeda não definida";

export function formatarMoedaOuIndefinida(valor: number | string, moeda: string | null | undefined): string {
  return moeda && moeda.trim() !== "" ? formatarMoeda(valor, moeda) : MOEDA_NAO_DEFINIDA;
}

export function somarPorMoeda(itens: ValorMoeda[]): ValorMoeda[] {
  const mapa = new Map<string, number>();
  for (const it of itens) {
    const m = normalizar(it.moeda);
    mapa.set(m, (mapa.get(m) ?? 0) + (Number.isFinite(it.valor) ? it.valor : 0));
  }
  return [...mapa.entries()]
    .map(([moeda, valor]) => ({ moeda, valor }))
    .sort((a, b) => ordemMoeda(a.moeda) - ordemMoeda(b.moeda) || a.moeda.localeCompare(b.moeda));
}

export function formatarValores(valores: ValorMoeda[]): string {
  if (!valores || valores.length === 0) return "—";
  return valores.map((v) => formatarMoeda(v.valor, v.moeda)).join(" · ");
}

export interface Consolidado {
  alvo: string;
  valor: number;
  faltando: string[];
}

export function consolidar(valores: ValorMoeda[], alvo: string, taxas: Record<string, number>): Consolidado {
  const alvoN = normalizar(alvo);
  const taxaAlvo = alvoN === "USD" ? 1 : taxas[alvoN];
  const faltando: string[] = [];
  let totalUsd = 0;
  for (const v of valores) {
    const m = normalizar(v.moeda);
    const taxa = m === "USD" ? 1 : taxas[m];
    if (!taxa || !Number.isFinite(taxa) || taxa <= 0) {
      faltando.push(m);
      continue;
    }
    totalUsd += (Number.isFinite(v.valor) ? v.valor : 0) / taxa;
  }
  if (!taxaAlvo || !Number.isFinite(taxaAlvo) || taxaAlvo <= 0) {
    return { alvo: alvoN, valor: 0, faltando: [...new Set([alvoN, ...faltando])] };
  }
  return { alvo: alvoN, valor: totalUsd * taxaAlvo, faltando: [...new Set(faltando)] };
}
