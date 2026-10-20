import type { DesfechoAcao } from "@/lib/acao-cliente";

// Tentativa de "Ligar por N horas" da supervisão (#166, PR #267 B1/C5). O `ate` é calculado no clique; só um
// resultado INCERTO (a ação pode ter sido gravada) faz o próximo clique da mesma opção mandar o mesmo `ate`, para
// o servidor reconhecer o estado-alvo e não gravar outro Evento. Depois de ok ou de erro definitivo nada foi
// gravado por esta tentativa, então o próximo clique conta de novo a partir de agora.

export type TentativaSupervisao = { horas: number; ate: Date } | null;

const HORA_MS = 3_600_000;

/** O `ate` a mandar agora: o da tentativa incerta da mesma opção, se ainda futuro; senão `agora + horas`. */
export function ateParaLigar(anterior: TentativaSupervisao, horas: number, agora: number): Date {
  if (anterior && anterior.horas === horas && anterior.ate.getTime() > agora) return anterior.ate;
  return new Date(agora + horas * HORA_MS);
}

/** A tentativa que sobrevive ao desfecho: só o incerto a guarda (null = clique ignorado, nada mudou). */
export function tentativaDepoisDo(desfecho: DesfechoAcao<unknown> | null, tentativa: TentativaSupervisao): TentativaSupervisao {
  if (desfecho === null) return tentativa;
  return desfecho.tipo === "incerto" ? tentativa : null;
}
