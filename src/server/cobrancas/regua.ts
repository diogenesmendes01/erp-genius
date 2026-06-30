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

const ULTIMO_OFFSET = REGUA[REGUA.length - 1].offsetDias;

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

/**
 * Decide a ação devida de UMA cobrança na régua. Regras (doc 24):
 * - quitada → sai da régua;
 * - promessa vigente (data ainda não passou) → dormente;
 * - a ação devida é o degrau MAIS AVANÇADO que já chegou (data ≤ hoje) e ainda não foi cumprido;
 *   os degraus anteriores não cumpridos são "superados" (não se manda D-7 quando já se está em D+3);
 * - BACKLOG: um degrau cuja data já passou e não foi feito continua devido (atrasadaNaAcao=true)
 *   até ser cumprido ou superado pelo próximo — dias pulados nunca "somem".
 */
export function proximaAcao(entrada: EntradaRegua, hoje: Date): ResultadoRegua {
  const diasAtraso = diferencaEmDias(hoje, entrada.vencimento);
  const promessaAte = entrada.promessaAte ?? null;

  if (entrada.quitada) {
    return { estado: "quitada", degrau: null, atrasadaNaAcao: false, diasAtraso, prioridade: 999, promessaAte };
  }
  // Promessa vigente = data prometida ainda não passou (>= hoje). Dormente até lá.
  if (promessaAte && diferencaEmDias(promessaAte, hoje) >= 0) {
    return { estado: "promessa", degrau: null, atrasadaNaAcao: false, diasAtraso, prioridade: 900, promessaAte };
  }

  const feitos = new Set(entrada.passosFeitos);
  // Degraus que já chegaram (offset ≤ diasAtraso) e ainda não foram cumpridos.
  const devidos = REGUA.filter((d) => d.offsetDias <= diasAtraso && !feitos.has(d.passo));

  if (devidos.length === 0) {
    const todosCumpridos = REGUA.every((d) => d.offsetDias > diasAtraso || feitos.has(d.passo));
    if (diasAtraso >= ULTIMO_OFFSET && todosCumpridos) {
      return { estado: "concluida", degrau: null, atrasadaNaAcao: false, diasAtraso, prioridade: 800, promessaAte };
    }
    // Nada a fazer ainda: ou antes do D-7, ou os degraus que chegaram já foram feitos.
    return { estado: "futuro", degrau: null, atrasadaNaAcao: false, diasAtraso, prioridade: 700, promessaAte };
  }

  const degrau = devidos[devidos.length - 1]; // o mais avançado que chegou e não foi feito
  const atrasadaNaAcao = diasAtraso > degrau.offsetDias; // já passou a data do degrau
  return {
    estado: "acao_devida",
    degrau,
    atrasadaNaAcao,
    diasAtraso,
    prioridade: prioridadeDe(degrau),
    promessaAte,
  };
}
