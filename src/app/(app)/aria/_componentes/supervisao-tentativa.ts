import type { DesfechoAcao } from "@/lib/acao-cliente";

export type TentativaSupervisao = { horas: number; ate: Date } | null;

const HORA_MS = 3_600_000;

export function ateParaLigar(anterior: TentativaSupervisao, horas: number, agora: number): Date {
  if (anterior && anterior.horas === horas && anterior.ate.getTime() > agora) return anterior.ate;
  return new Date(agora + horas * HORA_MS);
}

export function tentativaDepoisDo(desfecho: DesfechoAcao<unknown> | null, tentativa: TentativaSupervisao): TentativaSupervisao {
  if (desfecho === null) return tentativa;
  return desfecho.tipo === "incerto" ? tentativa : null;
}
