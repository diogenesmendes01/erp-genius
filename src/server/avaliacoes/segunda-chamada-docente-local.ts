"use server";
import { z } from "zod";
import { executarAcao } from "@/server/_shared";
import { instanteAvaliacaoLocal } from "./tempo";
import { registrarRealizacaoSegundaChamada } from "./segunda-chamada-realizacao";

export async function realizarSegundaChamadaLocal(input: { reservaId: string; dataHora: string; fuso: string; evidencia: string }) {
  const preparado = await executarAcao(async () => {
    const d = z.object({ reservaId: z.string(), dataHora: z.string(), fuso: z.string(), evidencia: z.string() }).strict().parse(input);
    return { reservaId: d.reservaId, evidencia: d.evidencia, realizadaEm: instanteAvaliacaoLocal(d.dataHora, d.fuso).toISOString() };
  });
  if (!preparado.ok) return preparado;
  return registrarRealizacaoSegundaChamada(preparado.dado!);
}
