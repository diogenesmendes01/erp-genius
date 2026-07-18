import type { ModeloWhatsapp } from "@/server/financeiro/schema";

// CÉREBRO da cobrança (doc 24). Função PURA, determinística, sem IA: dada uma cobrança, o que
// já foi feito e a data de hoje, decide qual é a ação devida na RÉGUA. O "braço" (humano hoje,
// cron amanhã) só executa o que esta função decide — por isso ela NÃO conhece I/O nem UI.

export type PassoRegua = "D-7" | "D-3" | "D0" | "D+3" | "D+7" | "D+15";
export type TipoAcao = "lembrar" | "cobrar" | "bloquear";

export interface DegrauRegua {
  passo: PassoRegua;
  /** Dias relativos ao vencimento (negativo = antes do vencimento). */
  offsetDias: number;
  tipo: TipoAcao;
  /** Template de WhatsApp sugerido para este degrau (reaproveita os modelos existentes). */
  template: ModeloWhatsapp;
  rotulo: string;
}

// A régua da escola (doc 24 §A régua). Ordem CRESCENTE de offset é pressuposto do algoritmo.
export const REGUA: readonly DegrauRegua[] = [
  { passo: "D-7", offsetDias: -7, tipo: "lembrar", template: "amigavel", rotulo: "Lembrete · 7 dias antes" },
  { passo: "D-3", offsetDias: -3, tipo: "lembrar", template: "amigavel", rotulo: "Lembrete · 3 dias antes" },
  { passo: "D0", offsetDias: 0, tipo: "cobrar", template: "dados", rotulo: "Cobrança no vencimento" },
  { passo: "D+3", offsetDias: 3, tipo: "cobrar", template: "vencida", rotulo: "Cobrança · 3 dias de atraso" },
  { passo: "D+7", offsetDias: 7, tipo: "cobrar", template: "vencida", rotulo: "Cobrança · 7 dias de atraso" },
  { passo: "D+15", offsetDias: 15, tipo: "bloquear", template: "firme", rotulo: "Bloqueio de acesso · 15 dias" },
] as const;

// (doc 26/30) A REGUA acima é o DEFAULT DE FÁBRICA. Em runtime a política pode vir do banco
// (PoliticaRegua/DegrauPolitica — ver ./politica.ts); o cérebro recebe os degraus como
// parâmetro e continua puro. Pressuposto mantido: ordem CRESCENTE de offset.

export type EstadoCobranca =
  | "quitada" // paga/cancelada — fora da régua
  | "promessa" // promessa de pagamento vigente — dormente até a data prometida
  | "futuro" // ainda não chegou no primeiro degrau (ou os que chegaram já foram feitos)
  | "acao_devida" // há um degrau cuja ação está devida hoje
  | "concluida"; // todos os degraus já foram cumpridos (inclusive o D+15)

export interface ResultadoRegua {
  estado: EstadoCobranca;
  /** Degrau cuja ação está devida agora (null quando não há ação a fazer). */
  degrau: DegrauRegua | null;
  /** A data do degrau já passou e ele não foi cumprido (backlog) — não é "ação no dia". */
  atrasadaNaAcao: boolean;
  /** hoje − vencimento, em dias de calendário (negativo = antes do vencimento). */
  diasAtraso: number;
  /** Menor = mais urgente. Para ordenar a fila (UI pode refinar por valor/risco). */
  prioridade: number;
  promessaAte: Date | null;
}

export interface EntradaRegua {
  vencimento: Date;
  /** Status PAGO ou CANCELADA → a cobrança saiu da régua. */
  quitada: boolean;
  /** Degraus já cumpridos (dos eventos CobrancaEnviadaWhatsApp `{ passo }`). */
  passosFeitos: PassoRegua[];
  /** Data prometida (do evento PromessaPagamento `{ ate }`), se houver. */
  promessaAte?: Date | null;
}

function inicioDoDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Diferença em dias de calendário entre `a` e `b` (a − b), ignorando hora. */
export function diferencaEmDias(a: Date, b: Date): number {
  return Math.round((inicioDoDia(a).getTime() - inicioDoDia(b).getTime()) / 86400000);
}

/** Prioridade do degrau (menor = mais urgente): bloquear < cobrar (mais atraso) < lembrar. */
function prioridadeDe(d: DegrauRegua): number {
  if (d.tipo === "bloquear") return 0;
  if (d.tipo === "cobrar") return 10 - d.offsetDias; // D+7→3 · D+3→7 · D0→10
  return 20 - d.offsetDias; // lembrar: D-3→23 · D-7→27
}

// ── NÚCLEO GENÉRICO (doc 27 §Tese: "um motor de réguas, N políticas") ─────────
// Um cérebro só (doc 29 regra 1): a régua da cobrança (âncora = vencimento, unidade =
// DIAS de calendário) e as réguas comerciais (âncora = evento, unidade = MINUTOS) usam a
// MESMA seleção de degrau — muda só a ÂNCORA e a UNIDADE, resolvidas por cada wrapper.
//
// A ação devida é o degrau MAIS AVANÇADO cujo offset já chegou (offset ≤ posição) e que
// ainda não foi cumprido; os anteriores não cumpridos são "superados". `concluida` quando
// a última posição passou e todos os degraus foram feitos. Pressuposto: degraus em ordem
// CRESCENTE de offset. Puro e sem unidade — a "posição" é `agora − âncora` na unidade da
// política (o chamador calcula).

export type EstadoDegrau = "futuro" | "acao_devida" | "concluida";

export interface SelecaoDegrau<D> {
  estado: EstadoDegrau;
  /** Degrau devido (o mais avançado que chegou e não foi feito), ou null. */
  degrau: D | null;
  /** A posição já passou do offset do degrau (backlog) — não é "ação no ponto exato". */
  atrasada: boolean;
}

export function selecionarDegrau<D extends { offset: number; chave: string }>(
  posicao: number,
  degraus: readonly D[],
  feitos: ReadonlySet<string>,
): SelecaoDegrau<D> {
  const ultimoOffset = degraus.length ? degraus[degraus.length - 1].offset : Infinity;

  // CORTE DE PROGRESSO — a régua só anda para FRENTE (review PR #54). O offset do degrau
  // mais avançado JÁ executado é a linha de corte: um degrau anterior a ela nunca mais é
  // devido, mesmo que nunca tenha sido enviado (foi SUPERADO). Sem isto, feito o +30min e
  // recalculando, o motor voltaria e metralharia o D0 (backlog em ordem reversa).
  let corte = -Infinity;
  for (const d of degraus) if (feitos.has(d.chave) && d.offset > corte) corte = d.offset;

  // Devido: já chegou (offset ≤ posição), está à FRENTE do corte e não foi cumprido.
  const devidos = degraus.filter((d) => d.offset <= posicao && d.offset > corte && !feitos.has(d.chave));
  if (devidos.length === 0) {
    // Sem nada à frente por fazer: concluída se a última posição já passou (o degrau final
    // foi executado ou superado); senão, ainda é futuro (esperando o próximo offset chegar).
    if (posicao >= ultimoOffset) return { estado: "concluida", degrau: null, atrasada: false };
    return { estado: "futuro", degrau: null, atrasada: false };
  }
  const degrau = devidos[devidos.length - 1];
  return { estado: "acao_devida", degrau, atrasada: posicao > degrau.offset };
}

/**
 * Decide a ação devida de UMA cobrança na régua. Regras (doc 24):
 * - quitada → sai da régua;
 * - promessa vigente (data ainda não passou) → dormente;
 * - a ação devida é o degrau MAIS AVANÇADO que já chegou (data ≤ hoje) e ainda não foi cumprido;
 *   os degraus anteriores não cumpridos são "superados" (não se manda D-7 quando já se está em D+3);
 * - BACKLOG: um degrau cuja data já passou e não foi feito continua devido (atrasadaNaAcao=true)
 *   até ser cumprido ou superado pelo próximo — dias pulados nunca "somem".
 */
export function proximaAcao(
  entrada: EntradaRegua,
  hoje: Date,
  politica: readonly DegrauRegua[] = REGUA,
): ResultadoRegua {
  const diasAtraso = diferencaEmDias(hoje, entrada.vencimento);
  const promessaAte = entrada.promessaAte ?? null;

  if (entrada.quitada) {
    return { estado: "quitada", degrau: null, atrasadaNaAcao: false, diasAtraso, prioridade: 999, promessaAte };
  }
  // Promessa vigente = data prometida ainda não passou (>= hoje). Dormente até lá.
  if (promessaAte && diferencaEmDias(promessaAte, hoje) >= 0) {
    return { estado: "promessa", degrau: null, atrasadaNaAcao: false, diasAtraso, prioridade: 900, promessaAte };
  }

  // Seleção pelo núcleo genérico. Unidade da cobrança = DIAS (posição = diasAtraso);
  // `orig` preserva o DegrauRegua original no retorno (template/tipo/rotulo intactos).
  const sel = selecionarDegrau(
    diasAtraso,
    politica.map((d) => ({ offset: d.offsetDias, chave: d.passo, orig: d })),
    new Set(entrada.passosFeitos),
  );

  if (sel.estado === "concluida") {
    return { estado: "concluida", degrau: null, atrasadaNaAcao: false, diasAtraso, prioridade: 800, promessaAte };
  }
  if (sel.estado === "futuro") {
    return { estado: "futuro", degrau: null, atrasadaNaAcao: false, diasAtraso, prioridade: 700, promessaAte };
  }

  const degrau = sel.degrau!.orig; // o mais avançado que chegou e não foi feito
  return {
    estado: "acao_devida",
    degrau,
    atrasadaNaAcao: sel.atrasada,
    diasAtraso,
    prioridade: prioridadeDe(degrau),
    promessaAte,
  };
}

// ── Wrapper COMERCIAL (doc 27): réguas ancoradas em EVENTO, unidade = MINUTOS ──
// "Lead novo sem resposta" (D0·+30min·+4h·+24h·+3d·+7d — doc 08), no-show, proposta etc.
// entram AQUI, no mesmo núcleo — nunca num "followUpEngine" paralelo (doc 29 regra 1).
// As stop-conditions (inbound novo, mudança de etapa, opt-out, vendedor assumiu) são
// avaliadas pelo despachante/cron (doc 27 §regras transversais), não pelo cérebro puro:
// aqui `encerrada` chega já resolvida pelo chamador.

export interface DegrauAncora {
  /** Identificador do degrau (idempotência por passo, como na cobrança). */
  passo: string;
  /** Minutos após a âncora (0 = no evento; 30 = +30min; 10080 = +7d). */
  offsetMinutos: number;
}

export interface EntradaAncora {
  /** O evento âncora (ex.: 1ª mensagem do lead sem resposta). */
  ancoraEm: Date;
  /** A régua saiu de cena (lead respondeu / mudou etapa / opt-out / perdido) — resolvido fora. */
  encerrada: boolean;
  passosFeitos: readonly string[];
}

export interface ResultadoAncora {
  estado: "encerrada" | "futuro" | "acao_devida" | "concluida";
  /** Passo devido agora, ou null. */
  passo: string | null;
  atrasada: boolean;
  minutosDesdeAncora: number;
}

/** Decide o passo devido de UMA régua ancorada em evento (minutos). Puro — sem I/O. */
export function proximaAcaoAncora(
  entrada: EntradaAncora,
  agora: Date,
  degraus: readonly DegrauAncora[],
): ResultadoAncora {
  const minutosDesdeAncora = Math.floor((agora.getTime() - entrada.ancoraEm.getTime()) / 60_000);
  if (entrada.encerrada) {
    return { estado: "encerrada", passo: null, atrasada: false, minutosDesdeAncora };
  }
  const sel = selecionarDegrau(
    minutosDesdeAncora,
    degraus.map((d) => ({ offset: d.offsetMinutos, chave: d.passo })),
    new Set(entrada.passosFeitos),
  );
  return {
    estado: sel.estado,
    passo: sel.degrau?.chave ?? null,
    atrasada: sel.atrasada,
    minutosDesdeAncora,
  };
}
