import type { ParticipacaoAula } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";

export function participacaoParaRegistro(
  entrada: { presente: boolean | null; participacao?: ParticipacaoAula }, matriculaId: string | null,
  anterior?: { matriculaId?: string | null; participacao?: ParticipacaoAula | null; presente: boolean | null },
) {
  if (entrada.participacao && !matriculaId) throw new ErroRegra("Identifique a matrícula histórica antes de classificar a participação.");
  if (anterior?.matriculaId && anterior.matriculaId !== matriculaId) throw new ErroRegra("A matrícula do registro não corresponde ao vínculo conferido.");
  return {
    matriculaId: anterior ? anterior.matriculaId ?? (entrada.participacao ? matriculaId : null) : matriculaId,
    participacao: entrada.participacao ?? (anterior?.presente === entrada.presente ? anterior.participacao ?? null : null),
  };
}
