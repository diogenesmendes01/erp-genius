// Calendário de atendimento do setor (SLA, P5 da Task 39): funções puras, sem banco.
import { z } from "zod";
import { candidatosDaGrade } from "@/server/agenda/grade";
import { dataHoraAvaliacaoLocal } from "@/server/avaliacoes/tempo";
import { DataCivilSchema } from "@/server/matricula/cobertura";

const HHMM = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:MM.");
const MAX_DIAS = 400;
const DIA_MS = 86_400_000;

const IntervaloSchema = z.object({
  /** 0 = domingo … 6 = sábado. */
  dia: z.number().int().min(0).max(6),
  inicio: HHMM,
  fim: HHMM,
}).strict();
type Intervalo = z.infer<typeof IntervaloSchema>;

/** Horário de atendimento: hora civil no fuso da escola. Vários intervalos por dia são aceitos (almoço). */
export const HorarioAtendimentoSchema = z.object({
  intervalos: z.array(IntervaloSchema).max(28),
  feriados: z.array(DataCivilSchema).max(366).default([]),
}).strict()
  .refine((h) => h.intervalos.every((i) => i.inicio < i.fim), { message: "O fim do horário deve ser depois do início.", path: ["intervalos"] })
  .refine((h) => !temSobreposicao(h.intervalos), { message: "Há horários sobrepostos no mesmo dia.", path: ["intervalos"] });

export type HorarioAtendimento = z.infer<typeof HorarioAtendimentoSchema>;

function temSobreposicao(intervalos: Intervalo[]): boolean {
  const ordenados = [...intervalos].sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio));
  return ordenados.some((i, k) => k > 0 && ordenados[k - 1].dia === i.dia && i.inicio < ordenados[k - 1].fim);
}

/** Intervalos ordenados por dia e início: forma canônica para comparar e gravar. */
export function horarioCanonico(h: HorarioAtendimento): HorarioAtendimento {
  return {
    intervalos: [...h.intervalos].sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio)).map((i) => ({ dia: i.dia, inicio: i.inicio, fim: i.fim })),
    feriados: [...new Set(h.feriados)].sort(),
  };
}

const somarDias = (data: string, n: number) => new Date(Date.parse(`${data}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
const diaDaSemana = (data: string) => new Date(`${data}T00:00:00Z`).getUTCDay();
const minutosDe = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const hhmmDe = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * Instante da hora civil `hora` em `data`. Hora pulada pelo horário de verão avança de hora em hora até
 * existir; hora repetida (dobra) usa a primeira ocorrência. Nunca lança por DST.
 */
function instanteLocal(data: string, hora: string, fuso: string): Date {
  for (let m = minutosDe(hora); m < 24 * 60; m += 60) {
    const c = candidatosDaGrade(data, hhmmDe(m), fuso);
    if (c.length) return c[0];
  }
  // Pulo que atravessa a meia-noite: o fim do dia é o início do seguinte.
  return instanteLocal(somarDias(data, 1), "00:00", fuso);
}

function intervalosDoDia(cal: HorarioAtendimento, data: string): Intervalo[] {
  if (cal.feriados.includes(data)) return [];
  const dia = diaDaSemana(data);
  return cal.intervalos.filter((i) => i.dia === dia).sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/**
 * Vencimento do prazo de `minutos` a partir de `inicio`, contando só dentro do calendário (no fuso da
 * escola). Sem calendário ou sem intervalos, a contagem é corrida. Fora do horário, o relógio começa na
 * próxima abertura; a sobra do dia passa para o próximo dia de atendimento. Se o prazo não couber em
 * 400 dias do calendário (dias de atendimento todos em feriados), avisa no log e conta corrido; nunca lança.
 */
export function prazoVenceEm(inicio: Date, minutos: number, calendario: HorarioAtendimento | null, fuso: string): Date {
  if (!calendario || calendario.intervalos.length === 0) return new Date(inicio.getTime() + minutos * 60_000);
  let restante = minutos * 60_000;
  let cursor = inicio.getTime();
  const primeiroDia = dataHoraAvaliacaoLocal(inicio, fuso).slice(0, 10);
  for (let k = 0; k < MAX_DIAS; k++) {
    const data = somarDias(primeiroDia, k);
    for (const i of intervalosDoDia(calendario, data)) {
      const abre = instanteLocal(data, i.inicio, fuso).getTime();
      const fecha = instanteLocal(data, i.fim, fuso).getTime();
      if (fecha <= cursor) continue;
      const desde = Math.max(cursor, abre);
      const disponivel = fecha - desde;
      if (disponivel <= 0) continue;
      if (restante <= disponivel) return new Date(desde + restante);
      restante -= disponivel;
      cursor = fecha;
    }
  }
  // Quem chama é o inbound, dentro da transação: não lançar (C2 da R1 do #241). Como o horário inválido em
  // `prazoRespostaEm`, avisa no log e conta corrido.
  console.warn(`[sla] prazo não cabe em ${MAX_DIAS} dias do horário de atendimento; prazo contado corrido.`);
  return new Date(inicio.getTime() + minutos * 60_000);
}

/** O instante está dentro de um intervalo de atendimento (fechamento exclusivo; feriado fica fora). */
export function dentroDoHorario(instante: Date, calendario: HorarioAtendimento, fuso: string): boolean {
  const data = dataHoraAvaliacaoLocal(instante, fuso).slice(0, 10);
  const t = instante.getTime();
  return intervalosDoDia(calendario, data).some((i) => instanteLocal(data, i.inicio, fuso).getTime() <= t && t < instanteLocal(data, i.fim, fuso).getTime());
}
