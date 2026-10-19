// Período dos relatórios do CRM: limites de dia calculados no FUSO da escola (nunca em UTC), `fim` exclusivo.

import { inicioDoDiaCivil } from "@/server/operacao/fuso";

export interface Periodo {
  inicio: Date;
  fim: Date;
}

export interface FiltroPeriodo {
  tipo: "HOJE" | "7D" | "30D" | "PERSONALIZADO";
  de?: string;
  ate?: string;
}

const DIA_MS = 86_400_000;
const MAX_DIAS_PERSONALIZADO = 366;

interface Ymd {
  a: number;
  m: number;
  d: number;
}

/** Deslocamento (ms) do fuso em relação ao UTC no instante dado: local = utc + deslocamento. */
function deslocamentoMs(instante: number, fuso: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(instante));
  const v = (t: string) => Number(partes.find((p) => p.type === t)?.value);
  const local = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second"));
  return local - Math.floor(instante / 1000) * 1000;
}

/** Data civil (no fuso) de um instante. */
function dataCivil(instante: Date, fuso: string): Ymd {
  const local = new Date(instante.getTime() + deslocamentoMs(instante.getTime(), fuso));
  return { a: local.getUTCFullYear(), m: local.getUTCMonth() + 1, d: local.getUTCDate() };
}

/** Soma dias a uma data civil (aritmética de calendário, sem fuso). */
function somarDias(x: Ymd, dias: number): Ymd {
  const t = new Date(Date.UTC(x.a, x.m - 1, x.d + dias));
  return { a: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/**
 * Primeiro instante da data civil no fuso: a meia-noite local ou, no dia em que ela não existe (início do horário
 * de verão, como America/Santiago em 06/09/2026), a 01h (`inicioDoDiaCivil`).
 */
function meiaNoite(x: Ymd, fuso: string): Date {
  const p = (n: number, t: number) => String(n).padStart(t, "0");
  return inicioDoDiaCivil(`${p(x.a, 4)}-${p(x.m, 2)}-${p(x.d, 2)}`, fuso);
}

function lerYmd(s: string | undefined, campo: string): Ymd {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  if (!m) throw new Error(`Período inválido: "${campo}" deve estar no formato AAAA-MM-DD.`);
  const x = { a: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  const t = new Date(Date.UTC(x.a, x.m - 1, x.d));
  if (t.getUTCFullYear() !== x.a || t.getUTCMonth() + 1 !== x.m || t.getUTCDate() !== x.d) {
    throw new Error(`Período inválido: "${campo}" não é uma data existente.`);
  }
  return x;
}

export function periodoDoFiltro(f: FiltroPeriodo, fuso: string, agora: Date = new Date()): Periodo {
  if (f.tipo === "PERSONALIZADO") {
    const de = lerYmd(f.de, "de");
    const ate = lerYmd(f.ate, "ate");
    const dias = Math.round((Date.UTC(ate.a, ate.m - 1, ate.d) - Date.UTC(de.a, de.m - 1, de.d)) / DIA_MS) + 1;
    if (dias < 1) throw new Error("Período inválido: a data final é anterior à inicial.");
    if (dias > MAX_DIAS_PERSONALIZADO) throw new Error(`Período inválido: máximo de ${MAX_DIAS_PERSONALIZADO} dias.`);
    return { inicio: meiaNoite(de, fuso), fim: meiaNoite(somarDias(ate, 1), fuso) };
  }
  const dias = f.tipo === "HOJE" ? 1 : f.tipo === "7D" ? 7 : 30;
  const hoje = dataCivil(agora, fuso);
  return { inicio: meiaNoite(somarDias(hoje, -(dias - 1)), fuso), fim: meiaNoite(somarDias(hoje, 1), fuso) };
}

/** Período imediatamente anterior, com a mesma duração. */
export function periodoAnterior(p: Periodo): Periodo {
  const duracao = p.fim.getTime() - p.inicio.getTime();
  return { inicio: new Date(p.inicio.getTime() - duracao), fim: new Date(p.inicio.getTime()) };
}

/** Variação relativa. "—" quando falta dado ou o anterior é 0 (nunca Infinity/NaN). */
export function variacao(atual: number | null, anterior: number | null): { valor: number | null; texto: string } {
  if (atual == null || anterior == null || !Number.isFinite(atual) || !Number.isFinite(anterior) || anterior === 0) {
    return { valor: null, texto: "—" };
  }
  const valor = (atual - anterior) / anterior;
  const pct = Math.round(valor * 100);
  const texto = pct > 0 ? `+${pct}%` : pct < 0 ? `−${Math.abs(pct)}%` : "0%";
  return { valor, texto };
}
