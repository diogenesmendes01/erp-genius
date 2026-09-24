// Formatação e agregação de dinheiro multi-moeda. Fonte ÚNICA — substitui o
// `valor.toLocaleString("pt-BR")` que estava copiado em dezenas de telas (sem símbolo,
// locale fixo). Duas garantias centrais:
//   1. cada moeda formata com seu símbolo e casas decimais corretos (₡ sem centavos, US$ com 2);
//   2. somas NUNCA misturam moedas — `somarPorMoeda` agrupa e devolve uma linha por moeda.
// A consolidação numa moeda única (com câmbio) é outra camada (Fase B) — aqui nada converte.

export interface ValorMoeda {
  moeda: string;
  valor: number;
}

// Símbolo por moeda. Foco nos mercados Genius (América Latina/Central) + real (matriz BR).
// Moeda desconhecida cai para o próprio código ISO (ex.: "PEN 50"), nunca quebra.
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

// Moedas que, por convenção local, circulam sem centavos.
const SEM_DECIMAIS = new Set(["CRC", "CLP", "PYG", "COP", "ISK", "JPY"]);

function normalizar(moeda: string): string {
  return (moeda ?? "").trim().toUpperCase();
}

/** Símbolo de exibição da moeda (ou o próprio código ISO se desconhecida). */
export function simboloMoeda(moeda: string): string {
  const m = normalizar(moeda);
  return SIMBOLO_MOEDA[m] ?? m;
}

/** Casas decimais que a moeda usa na exibição (0 para as que circulam sem centavos por
 *  convenção local — mesma lista de `formatarMoeda`). */
export function casasDecimais(moeda: string): number {
  return SEM_DECIMAIS.has(normalizar(moeda)) ? 0 : 2;
}

/**
 * Formata um valor na sua moeda, com símbolo e casas decimais corretos. O agrupamento
 * de milhar segue pt-BR (1.234.567,89) — padrão da matriz e consistente em toda a LATAM.
 * `semSimbolo` devolve só o número (quando o símbolo já é exibido à parte).
 * Aceita também o texto decimal que vem do servidor ("1250.00", Decimal serializado): várias
 * telas imprimiam esse texto cru ao lado do código da moeda ("1250.00 CRC") — E5 da auditoria.
 */
export function formatarMoeda(valor: number | string, moeda: string, opts?: { semSimbolo?: boolean }): string {
  const m = normalizar(moeda);
  const casas = SEM_DECIMAIS.has(m) ? 0 : 2;
  const n = typeof valor === "string" ? Number(valor) : valor;
  const numero = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(Number.isFinite(n) ? n : 0);
  if (opts?.semSimbolo) return numero;
  const simbolo = SIMBOLO_MOEDA[m] ?? m;
  return simbolo ? `${simbolo} ${numero}` : numero;
}

// USD primeiro (referência de consolidação), depois as demais em ordem alfabética.
function ordemMoeda(moeda: string): number {
  return moeda === "USD" ? 0 : 1;
}

/**
 * Interpreta o texto digitado num campo de dinheiro. Aceita SOMENTE um separador decimal —
 * vírgula OU ponto, nunca os dois juntos — e rejeita qualquer outra coisa (incluindo separador
 * de milhar): "1.234" não vira 1234 nem 1,234 por adivinhação, é considerado inválido. É a
 * mesma regra que já protegia RecebimentoDestinadoForm.tsx (antiga `centavos()` local,
 * promovida pra cá — ver docs/42-auditoria-frontend-ux.md, achado "dinheiro em
 * type=number step=0.01"), agora compartilhada por todo `CampoMoeda`.
 * Devolve o valor na unidade principal da moeda (não em centavos) ou `null` se o texto
 * estiver vazio ou não puder ser interpretado com segurança — a chamadora decide a mensagem.
 */
export function parseMoeda(texto: string): number | null {
  const normalizado = texto.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalizado)) return null;
  return Number(normalizado);
}

/**
 * Formata um valor já válido para reexibição no campo, sempre com vírgula decimal e sem
 * separador de milhar (o que `parseMoeda` entende de volta, sem ambiguidade). Uso típico:
 * normalizar o texto do campo ao perder o foco (`onBlur`), depois que o operador termina de
 * digitar — nunca a cada tecla, para não brigar com o cursor.
 * `moeda` é opcional: quando informada, respeita as casas decimais da moeda (CRC/CLP saem
 * sem centavos, "100" em vez de "100,00" — mesma convenção de `formatarMoeda`); omitida,
 * usa duas casas (comportamento anterior, para quem ainda não tem a moeda à mão).
 */
export function formatarMoedaParaCampo(valor: number, moeda?: string): string {
  const casas = moeda ? casasDecimais(moeda) : 2;
  return valor.toFixed(casas).replace(".", ",");
}

/**
 * Soma itens {moeda, valor} agrupando por moeda — NUNCA mistura moedas diferentes num
 * total só. Devolve uma linha por moeda, ordenada (USD primeiro, depois alfabética).
 */
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

/**
 * Formata uma lista agregada {moeda, valor} para exibição inline: "₡ 2.500.000 · US$ 3.000".
 * Lista vazia → "—". Para layout rico (uma linha por moeda), itere `ValorMoeda[]` no JSX.
 */
export function formatarValores(valores: ValorMoeda[]): string {
  if (!valores || valores.length === 0) return "—";
  return valores.map((v) => formatarMoeda(v.valor, v.moeda)).join(" · ");
}

export interface Consolidado {
  alvo: string;
  valor: number;
  /** Moedas presentes nos valores mas SEM taxa cadastrada — não entraram no total. */
  faltando: string[];
}

/**
 * Consolida valores multi-moeda numa moeda-alvo, via PIVÔ ÚNICO USD (reporting-only — nunca
 * toca a conta do aluno). `taxas[moeda]` = quantas unidades da moeda equivalem a 1 USD (USD = 1).
 * Converte cada valor → USD → alvo. Moeda sem taxa é ignorada e reportada em `faltando`
 * (o total fica honesto: só soma o que dá para converter).
 */
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
  // Sem taxa para a própria moeda-alvo não dá para converter nada: total 0, alvo entra em faltando.
  if (!taxaAlvo || !Number.isFinite(taxaAlvo) || taxaAlvo <= 0) {
    return { alvo: alvoN, valor: 0, faltando: [...new Set([alvoN, ...faltando])] };
  }
  return { alvo: alvoN, valor: totalUsd * taxaAlvo, faltando: [...new Set(faltando)] };
}
