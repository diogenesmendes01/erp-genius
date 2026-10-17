import type { StatusTarefa } from "@prisma/client";
import { dataCivilInstitucional } from "@/server/operacao/fuso";

export type GrupoTarefa = "ATRASADAS" | "HOJE" | "AMANHA" | "PROXIMOS_7" | "DEPOIS" | "SEM_DATA" | "CONCLUIDAS";

/** Soma dias a uma data civil AAAA-MM-DD, sem depender de fuso (calendário gregoriano em UTC). */
export function somarDiasDataCivil(dataCivil: string, dias: number): string {
  const [a, m, d] = dataCivil.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

/**
 * Grupo de exibição da tarefa. "Hoje" é a data civil do fuso institucional; a comparação é de strings AAAA-MM-DD.
 * Atrasada: data anterior a hoje, ou hoje com horário (inicioEm) já passado. PROXIMOS_7 vai de amanhã+1 até hoje+7.
 * Concluída e cancelada ficam no grupo CONCLUIDAS.
 */
export function grupoDaTarefa(
  t: { dataCivil: string | null; inicioEm: Date | null; status: StatusTarefa },
  agora: Date,
  fuso: string,
): GrupoTarefa {
  if (t.status !== "ABERTA") return "CONCLUIDAS";
  if (!t.dataCivil) return "SEM_DATA";
  const hoje = dataCivilInstitucional(agora, fuso);
  if (t.dataCivil < hoje) return "ATRASADAS";
  if (t.dataCivil === hoje) return t.inicioEm && t.inicioEm.getTime() < agora.getTime() ? "ATRASADAS" : "HOJE";
  if (t.dataCivil === somarDiasDataCivil(hoje, 1)) return "AMANHA";
  if (t.dataCivil <= somarDiasDataCivil(hoje, 7)) return "PROXIMOS_7";
  return "DEPOIS";
}
