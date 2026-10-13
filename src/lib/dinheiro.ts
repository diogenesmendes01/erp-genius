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
  // Texto vazio, ilegível ("1.250,00"), NaN ou ausente (snapshot/JSON com cast) nunca vira um zero
  // monetário falso: sai "—", e em desenvolvimento um aviso aponta o valor.
  const n = typeof valor === "number" ? valor : typeof valor === "string" && valor.trim() !== "" ? Number(valor) : NaN;
  if (!Number.isFinite(n)) {
    if (process.env.NODE_ENV === "development") console.warn(`formatarMoeda: valor inválido ${JSON.stringify(valor)} (${m || "sem moeda"})`);
    return "—";
  }
  // Moedas sem centavos (CRC, CLP…) exibem 0 casas — mas uma fração existente nunca é escondida:
  // "₡ 1.250,50" e não "₡ 1.251" (o servidor compara valores exatos; o operador digitaria o
  // arredondado e seria recusado).
  const casas = SEM_DECIMAIS.has(m) && Number.isInteger(n) ? 0 : 2;
  const numero = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(n);
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
 *
 * Ponto ambíguo (C5 do doc 44, issue #167): em pt-BR o ponto é o separador de MILHAR (doc 42,
 * risco 6: "`1.234` (separador de milhar pt-BR) é aceito como 1,234"). "1.23" não é milhar
 * completo, mas tem o formato do começo de um ("1.230" com um dígito a menos, ou "123" com um
 * ponto a mais) — adivinhar 1,23 é exatamente o que o doc proíbe. Por isso o ponto só vale como
 * decimal quando NÃO pode ser milhar pt-BR:
 *   - parte inteira com 4+ dígitos ("1234.56"): quem agrupa milhar teria escrito "1.234";
 *   - parte inteira começando por 0 ("0.5", "0.50"): nenhum milhar começa por zero.
 * Com 1 a 3 dígitos antes do ponto ("1.23", "12.5", "100.50") o texto é recusado (null); a
 * vírgula ("1,23") continua sem ambiguidade e é o que o próprio campo produz no blur.
 *
 * Devolve o valor na unidade principal da moeda (não em centavos) ou `null` se o texto
 * estiver vazio ou não puder ser interpretado com segurança — a chamadora decide a mensagem.
 */
export function parseMoeda(texto: string): number | null {
  const limpo = texto.trim();
  // Vírgula decimal (o formato do campo) ou inteiro puro: sem ambiguidade.
  if (/^\d+(?:,\d{1,2})?$/.test(limpo)) return Number(limpo.replace(",", "."));
  const comPonto = /^(\d+)\.\d{1,2}$/.exec(limpo);
  if (!comPonto) return null;
  const inteiro = comPonto[1];
  // 1 a 3 dígitos sem zero à esquerda antes do ponto = possível milhar pt-BR → ambíguo, recusa.
  if (inteiro.length <= 3 && !inteiro.startsWith("0")) return null;
  return Number(limpo);
}

/**
 * Formata um valor já válido para reexibição no campo, sempre com vírgula decimal e sem
 * separador de milhar (o que `parseMoeda` entende de volta, sem ambiguidade). Uso típico:
 * normalizar o texto do campo ao perder o foco (`onBlur`), depois que o operador termina de
 * digitar — nunca a cada tecla, para não brigar com o cursor — e pré-preencher o campo com um
 * valor que veio do servidor.
 * `moeda` é opcional: quando informada, respeita as casas decimais da moeda (CRC/CLP saem
 * sem centavos, "100" em vez de "100,00" — mesma convenção de `formatarMoeda`); omitida,
 * usa duas casas (comportamento anterior, para quem ainda não tem a moeda à mão).
 * Moeda sem centavos com valor fracionado NUNCA é arredondada (C6 do doc 44, issue #167): sai
 * com duas casas ("100,50", não "101"), como `formatarMoeda` faz na exibição — quem decide o
 * valor é o operador, avisado pelo `CampoMoeda` (ver `avisoSemCentavos`).
 */
export function formatarMoedaParaCampo(valor: number, moeda?: string): string {
  const casas = moeda && casasDecimais(moeda) === 0 && Number.isInteger(valor) ? 0 : 2;
  return valor.toFixed(casas).replace(".", ",");
}

/**
 * Aviso para o texto de um campo de dinheiro numa moeda sem centavos (CRC, CLP…) quando ele traz
 * casas decimais: "100,50" em CRC. O campo não arredonda (C6 do doc 44, issue #167) — o operador
 * precisa ver o problema antes de salvar. Devolve null quando não há o que avisar: moeda com
 * centavos ou ausente, texto vazio ou não interpretável (esse é erro de quem valida o campo) ou
 * valor inteiro.
 */
export function avisoSemCentavos(texto: string, moeda?: string | null): string | null {
  if (!moeda || casasDecimais(moeda) !== 0) return null;
  const numero = parseMoeda(texto);
  if (numero === null || Number.isInteger(numero)) return null;
  return `${normalizar(moeda)} não tem centavos — informe um valor inteiro. O valor digitado não é arredondado.`;
}

/** Texto exibido no lugar de um valor cuja moeda não está definida (C20 do doc 44, issue #167). */
export const MOEDA_NAO_DEFINIDA = "moeda não definida";

/**
 * `formatarMoeda` para registros em que a moeda pode faltar (ex.: acordo de permuta com
 * `moeda` nula). Sem moeda, o número NÃO é exibido sem símbolo — um "1.250,00" solto num ERP
 * multimoeda seria lido na moeda errada —; sai o estado explícito `MOEDA_NAO_DEFINIDA`.
 */
export function formatarMoedaOuIndefinida(valor: number | string, moeda: string | null | undefined): string {
  return moeda && moeda.trim() !== "" ? formatarMoeda(valor, moeda) : MOEDA_NAO_DEFINIDA;
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
