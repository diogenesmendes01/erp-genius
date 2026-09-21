"use server";
import { z } from "zod";
import { executarAcao } from "@/server/_shared";
import { instanteAvaliacaoLocal } from "./tempo";
import { autorizarRealizacaoEspecialRecuperacao } from "./recuperacao-autorizacao-especial";

export async function autorizarRecuperacaoEspecialLocal(input: { itemReservaId: string; motivo: string; prazoLocal: string; fuso: string; chaveIdempotencia: string }) {
  const preparado = await executarAcao(async () => {
    const d = z.object({ itemReservaId: z.string(), motivo: z.string(), prazoLocal: z.string(), fuso: z.string(), chaveIdempotencia: z.string() }).strict().parse(input);
    return { itemReservaId: d.itemReservaId, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia,
      prazoAte: instanteAvaliacaoLocal(d.prazoLocal, d.fuso).toISOString() };
  });
  if (!preparado.ok) return preparado;
  return autorizarRealizacaoEspecialRecuperacao(preparado.dado!);
}
