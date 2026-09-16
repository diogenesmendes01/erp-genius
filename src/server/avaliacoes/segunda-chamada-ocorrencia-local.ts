"use server";

import { z } from "zod";
import { executarAcao } from "@/server/_shared";
import { instanteAvaliacaoLocal } from "./tempo";
import { registrarOcorrenciaSegundaChamada } from "./segunda-chamada-ocorrencia";

const schema = z.object({
  reservaId: z.string().min(1).max(100),
  tipo: z.enum(["CANCELAMENTO_ESCOLA", "CANCELAMENTO_ALUNO", "FALTA", "IMPEDIMENTO_ESCOLA"]),
  dataHoraLocal: z.string().min(1),
  fuso: z.string().min(1).max(100),
  motivo: z.string().trim().min(5).max(2000),
  evidencia: z.string().trim().min(5).max(4000),
}).strict();

export async function registrarOcorrenciaSegundaChamadaLocal(input: z.input<typeof schema>) {
  const preparado = await executarAcao(async () => {
    const d = schema.parse(input);
    return {
      reservaId: d.reservaId,
      tipo: d.tipo,
      ocorridaEm: instanteAvaliacaoLocal(d.dataHoraLocal, d.fuso).toISOString(),
      motivo: d.motivo,
      evidencia: d.evidencia,
    };
  });
  if (!preparado.ok) return preparado;
  return registrarOcorrenciaSegundaChamada(preparado.dado!);
}
