"use server";
import { z } from "zod";
import { executarAcao } from "@/server/_shared";
import { instanteAvaliacaoLocal } from "./tempo";
import { autorizarRealizacaoEspecialSegundaChamada } from "./segunda-chamada-autorizacao-especial";

export async function autorizarSegundaChamadaEspecialLocal(input: { alocacaoId: string; codigoAvaliacao: string; motivo: string; prazoLocal: string; fuso: string; chaveIdempotencia: string }) {
  const preparado = await executarAcao(async () => {
    const d = z.object({ alocacaoId: z.string(), codigoAvaliacao: z.string(), motivo: z.string(), prazoLocal: z.string(), fuso: z.string(), chaveIdempotencia: z.string() }).strict().parse(input);
    return { alocacaoId: d.alocacaoId, codigoAvaliacao: d.codigoAvaliacao, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia,
      prazoAte: instanteAvaliacaoLocal(d.prazoLocal, d.fuso).toISOString() };
  });
  if (!preparado.ok) return preparado;
  return autorizarRealizacaoEspecialSegundaChamada(preparado.dado!);
}
